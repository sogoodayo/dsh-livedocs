// Optional Context7 cloud-index backend — the LAST-resort docs source.
//
// Only active when the user provides an API key (settings: context7Key);
// empty key means the module is inert and performs zero network calls.
// Verified against https://context7.com/docs/api-guide (v2 REST API):
//   GET /api/v2/libs/search?libraryName=&query=   → { results: [{id, title, …}] }
//   GET /api/v2/context?libraryId=&query=&type=json
//        → { codeSnippets: [{codeTitle, codeList:[{code}]}], infoSnippets: [{content}] }
// Auth: Authorization: Bearer <key>   (keys start with "ctx7sk")
// Version pinning: /owner/repo@<version> (fall back to unpinned on 404).
//
// Pure Node with injectable fetch — unit-testable outside the harness.

const API_BASE = 'https://context7.com'
const FETCH_TIMEOUT_MS = 20000

/** Error carrying the HTTP status so callers can surface the real cause. */
export class Context7Error extends Error {
  constructor(message, status, retryAfter = null) {
    super(message)
    this.name = 'Context7Error'
    this.status = status
    this.retryAfter = retryAfter
  }
}

async function request(path, params, { apiKey, fetchImpl = fetch } = {}) {
  const url = `${API_BASE}${path}?${new URLSearchParams(params).toString()}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  let res
  try {
    res = await fetchImpl(url, {
      signal: ctrl.signal,
      headers: {
        'user-agent': 'dsh-livedocs/0.1',
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      redirect: 'follow',
    })
  } catch (err) {
    throw new Context7Error(`network error: ${err?.message ?? err}`, 0)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.message) message = body.message
    } catch {
      // non-JSON error body — keep the status line
    }
    const retryAfter = res.headers?.get?.('retry-after')
    throw new Context7Error(message, res.status, retryAfter ? Number(retryAfter) : null)
  }
  return res.json()
}

/**
 * Find Context7 library candidates by name.
 * @returns {Promise<Array<{id: string, title?: string, description?: string}>>}
 */
export async function searchLibrary(libraryName, { apiKey, query = '', fetchImpl } = {}) {
  const data = await request('/api/v2/libs/search', { libraryName, query }, { apiKey, fetchImpl })
  return Array.isArray(data?.results) ? data.results : []
}

function assembleMarkdown(data) {
  const parts = []
  for (const info of data?.infoSnippets ?? []) {
    if (typeof info?.content === 'string' && info.content.trim()) {
      parts.push(info.pageTitle ? `## ${info.pageTitle}\n\n${info.content}` : info.content)
    }
  }
  for (const snippet of data?.codeSnippets ?? []) {
    const codes = (snippet?.codeList ?? [])
      .filter((c) => typeof c?.code === 'string' && c.code.trim())
      .map((c) => `\`\`\`${c.codeLanguage ?? ''}\n${c.code}\n\`\`\``)
    if (codes.length) {
      parts.push(snippet.codeTitle ? `## ${snippet.codeTitle}\n\n${codes.join('\n\n')}` : codes.join('\n\n'))
    }
  }
  return parts.join('\n\n')
}

/**
 * Retrieve docs context for an exact Context7 library ID.
 * When `version` is given, the pinned ID (`/owner/repo@version`) is tried
 * first and silently falls back to the unpinned ID on 404.
 * @returns {Promise<{content: string, pinned: boolean} | null>}
 */
export async function fetchContext(libraryId, { apiKey, query = '', version = null, fetchImpl } = {}) {
  const attempts = version ? [`${libraryId}@${version}`, libraryId] : [libraryId]
  let pinned = false
  for (let i = 0; i < attempts.length; i++) {
    try {
      const data = await request(
        '/api/v2/context',
        { libraryId: attempts[i], query: query || 'overview', type: 'json' },
        { apiKey, fetchImpl },
      )
      const content = assembleMarkdown(data)
      if (!content || content.length < 200) return null
      pinned = i === 0 && attempts.length > 1
      return { content, pinned }
    } catch (err) {
      // Pinned version unknown to Context7 → retry unpinned; anything else
      // (401/429/5xx) is a real failure the caller should hear about.
      if (err instanceof Context7Error && err.status === 404 && i === 0 && attempts.length > 1) continue
      throw err
    }
  }
  return null
}

/**
 * Full fallback pipeline: library name → search → best match → docs context.
 * Returns the same shape as lib/sources.js fetchDocs() plus the Context7 ID,
 * or null when the library is unknown to Context7. Auth/rate/server failures
 * throw Context7Error so the caller can surface the cause instead of
 * silently reporting "no docs".
 *
 * @returns {Promise<{content: string, sourceType: string, sourceUrl: string, libraryId: string, pinned: boolean} | null>}
 */
export async function fetchDocsViaContext7(
  libraryName,
  { apiKey, topic = '', version = null, fetchImpl } = {},
) {
  if (!apiKey || !apiKey.trim()) return null
  const key = apiKey.trim()
  const results = await searchLibrary(libraryName, { apiKey: key, query: topic, fetchImpl })
  const best = results[0]
  if (!best?.id) return null
  const docs = await fetchContext(best.id, { apiKey: key, query: topic, version, fetchImpl })
  if (!docs) return null
  return {
    content: docs.content,
    sourceType: 'context7',
    sourceUrl: `${API_BASE}${best.id}`,
    libraryId: best.id,
    pinned: docs.pinned,
  }
}

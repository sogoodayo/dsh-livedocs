// Multi-source docs fetch pipeline with degradation chain:
//   1. llms.txt / llms-full.txt on the docs site
//   2. GitHub repo docs/ + README (tag-pinned when version given)
//   3. (optional, future) Context7 REST backend
//
// Pure Node, no DSH imports — unit-testable outside the harness.

const FETCH_TIMEOUT_MS = 15000
const USER_AGENT = 'dsh-livedocs/0.1 (+https://github.com/your-account/dsh-livedocs)'

async function fetchText(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/markdown,text/plain,text/html;q=0.5' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Resolve a library name to candidate doc sources.
 * Queries the npm registry for metadata (works for the JS ecosystem;
 * PyPI / crates.io resolvers can be added behind the same interface).
 *
 * User-added custom sources (settings `customDocs`) short-circuit the whole
 * resolution chain: exact name match wins before the npm registry is asked.
 *
 * @param {string} libraryName
 * @param {{ customDocs?: Array<{name: string, url: string, version?: string}> }} [options]
 * @returns {Promise<{ name: string, version: string|null, sources: Array<{type: string, url: string}> } | null>}
 */
export async function resolveLibrary(libraryName, { customDocs = [] } = {}) {
  const custom = customDocs.find(
    (doc) => doc && typeof doc.name === 'string' && doc.name.toLowerCase() === libraryName.toLowerCase(),
  )
  if (custom && typeof custom.url === 'string') {
    return {
      name: libraryName,
      version: custom.version ?? null,
      description: 'user-added custom docs source',
      custom: true,
      sources: [{ type: 'custom', url: custom.url }],
    }
  }

  const meta = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(libraryName)}`)
  if (!meta) return null

  const version = meta['dist-tags']?.latest ?? null
  const repoUrl = normalizeRepoUrl(meta.repository)
  const homepage = typeof meta.homepage === 'string' ? meta.homepage : null

  const sources = []
  // Candidate 1: llms.txt on the docs site / homepage
  for (const base of [homepage, repoUrl && guessDocsSite(repoUrl)].filter(Boolean)) {
    sources.push({ type: 'llms-full.txt', url: base.replace(/\/$/, '') + '/llms-full.txt' })
    sources.push({ type: 'llms.txt', url: base.replace(/\/$/, '') + '/llms.txt' })
  }
  // Candidate 2: GitHub raw README (tag-pinned if version known)
  if (repoUrl) {
    const ref = version ? `v${version}` : 'HEAD'
    sources.push({ type: 'github-readme', url: `${repoUrlToRaw(repoUrl)}/${ref}/README.md` })
    sources.push({ type: 'github-readme', url: `${repoUrlToRaw(repoUrl)}/HEAD/README.md` })
  }
  return { name: libraryName, version, description: meta.description ?? null, sources }
}

async function fetchJson(url) {
  const text = await fetchText(url)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeRepoUrl(repo) {
  if (!repo) return null
  let url = typeof repo === 'string' ? repo : repo.url
  if (!url) return null
  url = url.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://')
  // npm repository fields may carry a fragment ("…#readme") or a monorepo
  // directory; both must be stripped before path matching or the fragment
  // leaks into candidate URLs and fetches the repo's HTML page as "docs".
  url = url.split('#')[0].split('?')[0]
  const m = url.match(/github\.com[/:]([^/]+\/[^/?#]+)/)
  return m ? `https://github.com/${m[1]}` : null
}

function repoUrlToRaw(repoUrl) {
  return repoUrl.replace('https://github.com/', 'https://raw.githubusercontent.com/')
}

// Common hosted-docs patterns; extend as needed.
function guessDocsSite(repoUrl) {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!m) return null
  return `https://${m[1]}.github.io/${m[2]}`
}

/**
 * Rebuild the source list for a requested version.
 *
 * Strategy: llms.txt sources stay FIRST — they carry the richest content but
 * always reflect the latest release (version-agnostic). Pinned GitHub tag
 * READMEs come next (version-accurate but thin), then the unpinned rest.
 * The caller annotates the output when a version-agnostic source is used
 * for a pinned-but-older version.
 */
export function sourcesForVersion(resolved, version) {
  if (!version) return resolved.sources
  const pinned = []
  for (const source of resolved.sources) {
    if (source.type !== 'github-readme') continue
    for (const ref of [`v${version}`, version]) {
      pinned.push({
        type: 'github-readme',
        url: source.url.replace(
          /(raw\.githubusercontent\.com\/[^/]+\/[^/]+\/)[^/]+(\/README\.md)$/,
          `$1${ref}$2`,
        ),
      })
    }
  }
  const isLlms = (s) => s.type.startsWith('llms')
  const seen = new Set()
  return [
    ...resolved.sources.filter(isLlms),
    ...pinned,
    ...resolved.sources.filter((s) => !isLlms(s)),
  ].filter((s) => {
    if (seen.has(s.url)) return false
    seen.add(s.url)
    return true
  })
}

/**
 * Fetch raw docs markdown for a resolved library, walking the degradation chain.
 * HTML pages are rejected: a typo'd candidate URL (or a fragment leak) would
 * otherwise cache a website's landing page as if it were documentation.
 * @returns {Promise<{ content: string, sourceType: string, sourceUrl: string } | null>}
 */
export async function fetchDocs(resolved, { version = null } = {}) {
  for (const source of sourcesForVersion(resolved, version)) {
    const content = await fetchText(source.url)
    if (content && content.length > 200 && !looksLikeHtml(content)) {
      return { content, sourceType: source.type, sourceUrl: source.url }
    }
  }
  return null
}

/** Cheap HTML sniff: docs sources are markdown/plain text, never full pages. */
function looksLikeHtml(text) {
  const head = text.slice(0, 500).trimStart().toLowerCase()
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<head')
}

// Exported for tests only.
export { normalizeRepoUrl as _normalizeRepoUrl, looksLikeHtml as _looksLikeHtml }

/**
 * Chunk markdown by headings, rank chunks against a topic, fit a token budget.
 * Rough estimate: 1 token ≈ 4 chars.
 *
 * @returns {{ text: string, chunksTotal: number, chunksUsed: number }}
 */
export function selectChunks(markdown, { topic = '', tokens = 4000 } = {}) {
  const chunks = chunkByHeadings(markdown)
  const keywords = topic.toLowerCase().split(/\s+/).filter(Boolean)
  const scored = chunks.map((c) => ({ ...c, score: scoreChunk(c, keywords) }))
  scored.sort((a, b) => b.score - a.score)

  const budgetChars = tokens * 4
  let used = 0
  const picked = []
  for (const chunk of scored) {
    if (keywords.length && chunk.score === 0) continue
    if (used + chunk.text.length > budgetChars) continue
    picked.push(chunk)
    used += chunk.text.length
  }
  // Restore document order for readability
  picked.sort((a, b) => a.order - b.order)
  return {
    text: picked.map((c) => c.text).join('\n\n'),
    chunksTotal: chunks.length,
    chunksUsed: picked.length,
  }
}

function chunkByHeadings(markdown) {
  const lines = markdown.split('\n')
  const chunks = []
  let current = []
  let order = 0
  const flush = () => {
    const text = current.join('\n').trim()
    if (text.length > 50) chunks.push({ text, order: order++ })
    current = []
  }
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line) && current.length) flush()
    current.push(line)
  }
  flush()
  return chunks
}

function scoreChunk(chunk, keywords) {
  if (!keywords.length) return 1
  const hay = chunk.text.toLowerCase()
  let score = 0
  for (const kw of keywords) {
    const firstLine = chunk.text.split('\n', 1)[0].toLowerCase()
    if (firstLine.includes(kw)) score += 5 // heading match weighs more
    const occurrences = hay.split(kw).length - 1
    score += Math.min(occurrences, 10)
  }
  return score
}

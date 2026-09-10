// dsh-livedocs — version-pinned live library docs for DeepSeek Harness.
// Pure ESM, no build step. Loaded as a Cordis bundle (see cordis.patch.yml).
//
// DSH contracts used here (verified against official docs & Discussion #961):
//   - export const inject = ['tools']  → apply() runs after the tool registry is ready
//   - defineTool from '@deepseek-ai/dsh-tools'
//   - object output schemas MUST set additionalProperties: true
//   - optional params simply omit `required`

import { defineTool } from '@deepseek-ai/dsh-tools'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { DocsCache } from './lib/cache.js'
import { resolveLibrary, fetchDocs, selectChunks } from './lib/sources.js'
import { detectInstalledVersion } from './lib/lockfile.js'

export const name = 'dsh-livedocs'
export const inject = ['tools']

const pluginDir = dirname(fileURLToPath(import.meta.url))

export function apply(ctx) {
  const cache = new DocsCache(join(pluginDir, 'data', 'cache'))

  // Load marker: lets users verify the host actually loaded this bundle
  // (check data/loaded.json after restarting dsh web).
  try {
    mkdirSync(join(pluginDir, 'data'), { recursive: true })
    writeFileSync(
      join(pluginDir, 'data', 'loaded.json'),
      JSON.stringify({ loadedAt: new Date().toISOString(), pid: process.pid }),
    )
  } catch {
    // never block plugin load on the marker
  }

  // ---------------------------------------------------------------- docs_resolve
  ctx.tools.register(
    defineTool({
      name: 'docs_resolve',
      description:
        'Resolve a library/package name to its live documentation sources ' +
        '(docs site llms.txt, GitHub repo, latest version). Call this BEFORE docs_query ' +
        'unless the user gave an exact library. Use it whenever you are about to write ' +
        'code against a third-party library API.',
      parameters: {
        libraryName: {
          type: 'string',
          required: true,
          description: 'Package name, e.g. "next", "react", "@tanstack/react-query".',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
        },
        render: (_args, value) => [
          {
            type: 'text',
            text: value.found
              ? `Resolved "${value.name}" (latest: ${value.version ?? 'unknown'}).\n` +
                `Sources:\n${value.sources.map((s) => `- [${s.type}] ${s.url}`).join('\n')}`
              : `Could not resolve "${value.name}". Try the exact npm package name.`,
          },
        ],
      },
      async execute(args) {
        const resolved = await resolveLibrary(args.libraryName)
        if (!resolved) return { found: false, name: args.libraryName }
        return { found: true, ...resolved }
      },
    }),
  )

  // ------------------------------------------------------------------ docs_query
  ctx.tools.register(
    defineTool({
      name: 'docs_query',
      description:
        'Fetch up-to-date, version-pinned documentation and code examples for a library. ' +
        'Results are cached locally (7-day TTL) and trimmed to a token budget. ' +
        'Do NOT call this more than 3 times per question; if docs are insufficient, ' +
        'answer with the best information you have and say so.',
      parameters: {
        library: {
          type: 'string',
          required: true,
          description: 'Library name (npm package name) or an exact id like "vercel/next.js".',
        },
        topic: {
          type: 'string',
          description: 'Narrow the docs, e.g. "routing", "hooks", "authentication".',
        },
        version: {
          type: 'string',
          description:
            'Pin a version, e.g. "19.1.0". If omitted, the version installed in the ' +
            'project (node_modules / lockfile) is used; falls back to the latest release.',
        },
        projectDir: {
          type: 'string',
          description:
            'Absolute path of the project used for automatic version detection. ' +
            'Defaults to the current working directory.',
        },
        tokens: {
          type: 'number',
          description: 'Max tokens of docs to return. Default 4000.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
        },
        render: (_args, value) => [
          {
            type: 'text',
            text:
              `--- BEGIN LIBRARY DOCS (${value.library}@${value.version ?? 'latest'}, ` +
              `version from: ${value.versionSource ?? 'unknown'}, ` +
              `source: ${value.sourceType ?? 'none'}${value.stale ? ', STALE CACHE' : ''}) ---\n` +
              `${value.text}\n--- END LIBRARY DOCS ---\n` +
              `(${value.chunksUsed}/${value.chunksTotal} sections within token budget)`,
          },
        ],
      },
      async execute(args) {
        const tokens = args.tokens ?? 4000
        const resolved = await resolveLibrary(args.library)
        if (!resolved) {
          return {
            library: args.library,
            version: null,
            text: `Library "${args.library}" could not be resolved.`,
            sourceType: null,
            stale: false,
            chunksTotal: 0,
            chunksUsed: 0,
          }
        }
        // Version resolution order: explicit arg > installed in project > latest release
        const detection = args.version
          ? null
          : detectInstalledVersion(args.projectDir ?? process.cwd(), resolved.name)
        const version = args.version ?? detection?.version ?? resolved.version
        const versionSource = args.version
          ? 'explicit'
          : (detection?.source ?? 'registry-latest')
        const cacheKey = `${resolved.name}@${version ?? 'latest'}|${resolved.sources[0]?.url ?? ''}`

        let fetched = null
        let stale = false
        const hit = cache.get(cacheKey)
        if (hit) {
          fetched = { content: hit.content, sourceType: 'cache', sourceUrl: cacheKey }
        } else {
          fetched = await fetchDocs(resolved, { version })
          if (fetched) {
            cache.set(cacheKey, fetched.content)
          } else {
            // Offline fallback: serve expired cache rather than nothing
            const staleHit = cache.get(cacheKey, { allowStale: true })
            if (staleHit) {
              fetched = { content: staleHit.content, sourceType: 'cache', sourceUrl: cacheKey }
              stale = true
            }
          }
        }

        if (!fetched) {
          return {
            library: resolved.name,
            version,
            text: 'No documentation source responded. The library may not publish llms.txt or a README.',
            sourceType: null,
            stale: false,
            chunksTotal: 0,
            chunksUsed: 0,
          }
        }

        const selected = selectChunks(fetched.content, { topic: args.topic ?? '', tokens })
        return {
          library: resolved.name,
          version,
          versionSource,
          text: selected.text || 'Docs were fetched but no section matched the topic within budget.',
          sourceType: fetched.sourceType,
          stale,
          chunksTotal: selected.chunksTotal,
          chunksUsed: selected.chunksUsed,
        }
      },
    }),
  )

  // ------------------------------------------------------------------ docs_setup
  const RULE_BEGIN = '<!-- dsh-livedocs:begin -->'
  const RULE_END = '<!-- dsh-livedocs:end -->'
  const RULE_BODY = [
    RULE_BEGIN,
    '## Live library docs (dsh-livedocs)',
    '',
    '- Always call `docs_query` BEFORE writing code against any third-party library API.',
    '- Never rely on training data for framework APIs (Next.js, React, Vue, etc.) — pull docs first, then code.',
    '- Pass `projectDir` (this project root) so the installed version is pinned automatically.',
    '- Use `topic` to narrow results and keep the default token budget unless more context is truly needed.',
    RULE_END,
  ].join('\n')

  ctx.tools.register(
    defineTool({
      name: 'docs_setup',
      description:
        'Install (or update) the dsh-livedocs usage rules into the project AGENTS.md, ' +
        'so the agent automatically consults live docs before using library APIs. ' +
        'Idempotent: the managed block is replaced in place, manual edits elsewhere are kept.',
      parameters: {
        projectDir: {
          type: 'string',
          required: true,
          description: 'Absolute path of the project root where AGENTS.md lives.',
        },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: value.message }],
      },
      async execute(args) {
        const target = join(args.projectDir, 'AGENTS.md')
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const blockPattern = new RegExp(`${esc(RULE_BEGIN)}[\\s\\S]*?${esc(RULE_END)}`)
        if (!existsSync(target)) {
          writeFileSync(target, `# Project Rules\n\n${RULE_BODY}\n`)
          return { ok: true, action: 'created', message: `Created ${target} with dsh-livedocs rules.` }
        }
        const current = readFileSync(target, 'utf8')
        let next
        if (blockPattern.test(current)) {
          // Replace the first managed block, remove any stray duplicates
          const globalPattern = new RegExp(blockPattern.source, 'g')
          let seen = false
          next = current.replace(globalPattern, () => {
            if (seen) return ''
            seen = true
            return RULE_BODY
          })
        } else {
          next = current.trimEnd() + `\n\n${RULE_BODY}\n`
        }
        writeFileSync(target, next)
        return {
          ok: true,
          action: blockPattern.test(current) ? 'updated' : 'appended',
          message: `dsh-livedocs rules ${blockPattern.test(current) ? 'updated' : 'appended'} in ${target}.`,
        }
      },
    }),
  )

  // ------------------------------------------------------------------ docs_cache
  ctx.tools.register(
    defineTool({
      name: 'docs_cache',
      description: 'Inspect or clear the local documentation cache.',
      parameters: {
        action: {
          type: 'string',
          required: true,
          enum: ['stats', 'clear'],
          description: '"stats" shows cache usage; "clear" deletes all cached docs.',
        },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      async execute(args) {
        if (args.action === 'clear') {
          cache.clear()
          return { ok: true, cleared: true }
        }
        return { ok: true, ...cache.stats() }
      },
    }),
  )

  ctx.logger?.info?.('dsh-livedocs loaded: docs_resolve / docs_query / docs_cache / docs_setup registered')
}

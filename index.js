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
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { DocsCache } from './lib/cache.js'
import { resolveLibrary, fetchDocs, selectChunks } from './lib/sources.js'
import { fetchDocsViaContext7 } from './lib/context7.js'
import { detectInstalledVersion } from './lib/lockfile.js'
import { findProjectRoot, listProjectDeps, formatDepsBlock } from './lib/project.js'
import { createConfigProvider, resolveProjectConfig } from './lib/config.js'
import { prefetchDeps } from './lib/prefetch.js'
import { rankDeps } from './lib/registry.js'
import { createSkillRegistration } from './lib/skill.js'
import { LivedocsController } from './lib/remote.js'

export const name = 'dsh-livedocs'
export const inject = ['tools']

const pluginDir = dirname(fileURLToPath(import.meta.url))

const DAY_MS = 24 * 3600 * 1000

export function apply(ctx) {
  // Cache lives in the DSH user home, not the plugin directory: the plugin
  // dir may be read-only or wiped on upgrade when installed via npm, and one
  // shared cache serves every profile and project.
  const cacheHome = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'livedocs')
  const cache = new DocsCache(join(cacheHome, 'cache'))

  // Global settings (设置 → 插件 → 插件配置) with per-project override.
  // When the settings service is absent the provider serves schema defaults.
  const configProvider = createConfigProvider(ctx)
  const globalConfig = () => configProvider.get()
  const configFor = (projectDir) => resolveProjectConfig(configProvider.get(), projectDir).config

  // Live cache TTL: the settings card edits take effect without a restart.
  const applyTtl = (cfg) => {
    cache.ttlMs = Math.max(1, cfg.cacheTtlDays ?? 7) * DAY_MS
    cache.maxEntries = Math.max(1, cfg.cacheMaxEntries ?? 200)
  }
  applyTtl(globalConfig())
  configProvider.watch(applyTtl)

  // ----------------------------------------------------- embedded skill (M5)
  // Register the livedocs skill into the host's skill registry so the agent
  // auto-loads usage rules when it works with third-party libraries — no
  // docs_setup run required. Optional integration like systemPrompt/commands:
  // profiles without the skill service simply skip. Reacts live to the
  // master switch and the `skill` toggle.
  ctx.inject(['skills'], (c) => {
    let dispose = null
    const sync = (cfg) => {
      const want = cfg.enabled !== false && cfg.skill !== false
      if (want && !dispose) {
        try {
          dispose = c.skills.register(createSkillRegistration())
          ctx.logger?.info?.('dsh-livedocs: skill "livedocs" registered')
        } catch (err) {
          ctx.logger?.warn?.(`dsh-livedocs: skill registration failed: ${err?.message ?? err}`)
        }
      } else if (!want && dispose) {
        dispose()
        dispose = null
      }
    }
    sync(globalConfig())
    configProvider.watch(sync)
    ctx.on('dispose', () => { dispose?.(); dispose = null })
  })

  // Remote endpoints for the settings card (cache management over the wire).
  // SRC-mode discovery: the gateway reflects on this live service — safe even
  // without the typert code generator. If the web API stack is absent the
  // service simply has no callers.
  try {
    // Own version for the update check — read from the plugin's package.json.
    let selfVersion = '0.0.0-dev'
    try {
      selfVersion = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8')).version ?? selfVersion
    } catch { /* dev check falls back to the placeholder */ }
    // eslint-disable-next-line no-new
    new LivedocsController(ctx, { cache, selfVersion })
  } catch (err) {
    ctx.logger?.warn?.(`dsh-livedocs: remote service unavailable: ${err?.message ?? err}`)
  }

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
            text: value.disabled
              ? 'dsh-livedocs is disabled (设置 → 插件 → 插件配置 → livedocs).'
              : value.found
                ? `Resolved "${value.name}" (latest: ${value.version ?? 'unknown'}).\n` +
                  `Sources:\n${value.sources.map((s) => `- [${s.type}] ${s.url}`).join('\n')}`
                : `Could not resolve "${value.name}". Try the exact npm package name.`,
          },
        ],
      },
      async execute(args) {
        if (!globalConfig().enabled) {
          return { found: false, name: args.libraryName, disabled: true }
        }
        const resolved = await resolveLibrary(args.libraryName, { customDocs: globalConfig().customDocs })
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
        'Fetch up-to-date documentation and code examples for a third-party library. ' +
        'IMPORTANT: always call this BEFORE writing code that uses an external library/framework API ' +
        '(React, Next.js, Vue, Tailwind, etc.) — never rely on training data for library APIs, ' +
        'they may be outdated. Pass projectDir so the installed version is pinned automatically. ' +
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
        render: (_args, value) => [{ type: 'text', text: formatDocsText(value) }],
      },
      execute: (args) => {
        const cfg = configFor(args.projectDir ?? process.cwd())
        if (!cfg.enabled) {
          return {
            library: args.library,
            version: null,
            text: 'dsh-livedocs is disabled (设置 → 插件 → 插件配置 → livedocs).',
            sourceType: null,
            stale: false,
            chunksTotal: 0,
            chunksUsed: 0,
          }
        }
        return runDocsQuery(cache, args, cfg)
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
    '- When a build/lint/test/runtime error points to a library API (unknown export, wrong signature, deprecated option), call `docs_query` for that library BEFORE attempting a fix — the API may have changed.',
    RULE_END,
  ].join('\n')

  ctx.tools.register(
    defineTool({
      name: 'docs_setup',
      description:
        'Install (or update) the dsh-livedocs usage rules into an AGENTS.md instructions file, ' +
        'so the agent automatically consults live docs before using library APIs. ' +
        'scope "project" writes the project AGENTS.md; scope "global" writes the user-global ' +
        '$DSH_HOME/AGENTS.md which applies to every project (recommended — do it once). ' +
        'Idempotent: the managed block is replaced in place, manual edits elsewhere are kept.',
      parameters: {
        projectDir: {
          type: 'string',
          description: 'Absolute path of the project root. Required unless scope is "global".',
        },
        scope: {
          type: 'string',
          enum: ['project', 'global'],
          description: '"project" (default) writes <projectDir>/AGENTS.md; "global" writes ~/.dsh/AGENTS.md.',
        },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: value.message }],
      },
      async execute(args) {
        const scope = args.scope ?? 'project'
        if (scope === 'project' && !args.projectDir) {
          return {
            ok: false,
            action: 'error',
            message: 'docs_setup: projectDir is required when scope is "project".',
          }
        }
        const target =
          scope === 'global'
            ? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'AGENTS.md')
            : join(args.projectDir, 'AGENTS.md')
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const blockPattern = new RegExp(`${esc(RULE_BEGIN)}[\\s\\S]*?${esc(RULE_END)}`)
        if (!existsSync(target)) {
          const title = scope === 'global' ? '# Global Rules' : '# Project Rules'
          writeFileSync(target, `${title}\n\n${RULE_BODY}\n`)
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

  // ------------------------------------------------------------------ /docs command
  // Register a user-facing slash command when the host provides the commands
  // service (web profile does). ctx.inject() waits for the service; if the
  // profile never provides it, the callback simply never runs and the plugin
  // still loads fine — do NOT move 'commands' into the top-level inject list.
  ctx.inject(['commands'], (c) => {
    c.effect(function* () {
      yield c.commands.register({
        name: 'docs',
        description: 'Query live library docs (version-pinned, cached)',
        input: { hint: '<library> [topic]' },
        handler: async (invocation) => {
          const input = invocation.rawInput.trim()
          if (!input) {
            return {
              kind: 'success',
              text:
                'Usage: /docs <library> [topic]\n' +
                'Examples:\n' +
                '  /docs react hooks\n' +
                '  /docs next routing\n' +
                'Docs are fetched live, pinned to the installed version when the ' +
                'current directory is a project, and cached for 7 days.',
            }
          }
          const [library, ...rest] = input.split(/\s+/)
          const topic = rest.join(' ')
          try {
            const cfg = configFor(process.cwd())
            if (!cfg.enabled) {
              return { kind: 'error', text: 'dsh-livedocs is disabled (设置 → 插件 → 插件配置 → livedocs).' }
            }
            const value = await runDocsQuery(cache, {
              library,
              topic,
              tokens: 2000,
              projectDir: process.cwd(),
            }, cfg)
            if (!value.sourceType) return { kind: 'error', text: value.text }
            return { kind: 'success', text: formatDocsText(value) }
          } catch (err) {
            return { kind: 'error', text: `docs query failed: ${err?.message ?? err}` }
          }
        },
      })
    }, 'dsh-livedocs command lifecycle')
  })

  // ------------------------------------------- deps context + docs prefetch
  // Inject a compact "installed dependencies" block into the system prompt so
  // the model can see project deps (with real versions) from the first turn,
  // and warm the docs cache for the top deps in the background.
  // Optional integration: ctx.inject() waits for the systemPrompt service and
  // silently skips on profiles without it — never a hard dependency.
  const sectionCache = new Map() // cwd → { text, at }
  const scanning = new Set()
  const SCAN_TTL_MS = 5 * 60 * 1000

  const scheduleScan = (cwd) => {
    if (scanning.has(cwd)) return
    scanning.add(cwd)
    void (async () => {
      try {
        const root = findProjectRoot(cwd)
        const cfg = configFor(root ?? cwd)
        // Wide pool: the injection block shows the first 8, but prefetch
        // walks further so failures and low-value deps don't waste the quota.
        const deps = root ? rankDeps(listProjectDeps(root, 30)) : []
        sectionCache.set(cwd, { text: cfg.injectDeps ? formatDepsBlock(deps.slice(0, 8)) : '', at: Date.now() })

        // Prefetch docs until N deps are warm — opportunistic, never surfaces errors
        if (!cfg.prefetch) return
        await prefetchDeps(deps, Math.max(0, cfg.prefetchTopN ?? 3), {
          resolveLibrary: (name) => resolveLibrary(name, { customDocs: cfg.customDocs }),
          fetchDocs,
          cache,
          cacheKey: (resolved, version) =>
            `${resolved.name}@${version ?? 'latest'}|${resolved.sources[0]?.url ?? ''}`,
        })
      } catch {
        // scanning is best-effort
      } finally {
        scanning.delete(cwd)
      }
    })()
  }

  ctx.inject(['systemPrompt'], (c) => {
    c.systemPrompt.section({
      name: 'dsh-livedocs:deps',
      order: -40,
      text: (assemble) => {
        const cwd = assemble?.agent?.session?.header?.cwd
        if (typeof cwd !== 'string' || !cwd) return ''
        if (!globalConfig().enabled) return ''
        const cached = sectionCache.get(cwd)
        if (!cached || Date.now() - cached.at > SCAN_TTL_MS) {
          scheduleScan(cwd) // fire-and-forget; the next assembly picks it up
        }
        return cached?.text ?? ''
      },
    })
  })

  ctx.logger?.info?.('dsh-livedocs loaded: docs_resolve / docs_query / docs_cache / docs_setup registered')
}

// ------------------------------------------------------------------ shared core

/**
 * Shared docs pipeline used by both the docs_query tool and the /docs command.
 * @param {import('./lib/cache.js').DocsCache} cache
 * @param {object} [config] - resolved plugin config (defaults when omitted).
 */
async function runDocsQuery(cache, args, config = null) {
  const tokens = args.tokens ?? 4000
  const customDocs = config?.customDocs ?? []
  const resolved = await resolveLibrary(args.library, { customDocs })
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
    : detection?.version
      ? detection.source
      : 'registry-latest'
  const cacheKey = `${resolved.name}@${version ?? 'latest'}|${resolved.sources[0]?.url ?? ''}`

  let fetched = null
  let stale = false
  let context7Error = null
  const hit = cache.get(cacheKey)
  if (hit) {
    fetched = { content: hit.content, sourceType: 'cache', sourceUrl: cacheKey }
  } else {
    fetched = await fetchDocs(resolved, { version })
    if (!fetched && config?.context7Key?.trim()) {
      // Last-resort cloud index: covers libraries that publish no llms.txt
      // and have a thin README. Failures are reported, not swallowed.
      try {
        fetched = await fetchDocsViaContext7(args.library, {
          apiKey: config.context7Key,
          topic: args.topic ?? '',
          version,
        })
      } catch (err) {
        context7Error = err
      }
    }
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
      text:
        'No documentation source responded. The library may not publish llms.txt or a README.' +
        (context7Error
          ? ` Context7 fallback failed (${context7Error.status || 'network'}: ${context7Error.message}).`
          : config?.context7Key?.trim()
            ? ' Context7 fallback found no matching library.'
            : ''),
      sourceType: null,
      stale: false,
      chunksTotal: 0,
      chunksUsed: 0,
    }
  }

  let selected = selectChunks(fetched.content, { topic: args.topic ?? '', tokens })
  let topicFallback = false
  if (selected.chunksUsed === 0 && args.topic) {
    // No section matched the topic — fall back to an overview within budget
    // instead of returning nothing.
    selected = selectChunks(fetched.content, { topic: '', tokens })
    topicFallback = true
  }

  // Honesty check: llms.txt sources always serve the LATEST docs. If the
  // resolved version is older, say so explicitly in the header. Same for the
  // Context7 fallback when its pinned-version fetch fell back to unpinned.
  const versionWarning =
    version &&
    resolved.version &&
    version !== resolved.version &&
    (fetched.sourceType ?? '').startsWith('llms')
      ? `WARNING: project uses ${version}, but this docs source serves the latest release (${resolved.version}). Verify APIs against ${version} before use.`
      : version && fetched.sourceType === 'context7' && fetched.pinned === false
        ? `WARNING: Context7 has no docs pinned to ${version}; serving its latest indexed docs. Verify APIs against ${version} before use.`
        : null

  return {
    library: resolved.name,
    version,
    versionSource,
    text:
      selected.text ||
      'Docs were fetched but nothing fit the token budget. Try a larger `tokens` value.',
    sourceType: fetched.sourceType,
    stale,
    versionWarning,
    topicFallback,
    chunksTotal: selected.chunksTotal,
    chunksUsed: selected.chunksUsed,
  }
}

/** Render the shared result value as the docs block shown to model or user. */
function formatDocsText(value) {
  return (
    `--- BEGIN LIBRARY DOCS (${value.library}@${value.version ?? 'latest'}, ` +
    `version from: ${value.versionSource ?? 'unknown'}, ` +
    `source: ${value.sourceType ?? 'none'}${value.stale ? ', STALE CACHE' : ''}) ---\n` +
    (value.versionWarning ? `${value.versionWarning}\n` : '') +
    (value.topicFallback
      ? 'NOTE: no section matched the topic; returning an overview instead.\n'
      : '') +
    `${value.text}\n--- END LIBRARY DOCS ---\n` +
    `(${value.chunksUsed}/${value.chunksTotal} sections within token budget)`
  )
}

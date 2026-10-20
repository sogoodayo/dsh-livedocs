// dsh-livedocs configuration: host-resolved config + per-project override.
//
// Layering (lowest wins first):
//   1. schema defaults (DEFAULT_CONFIG)
//   2. global user settings — cordis-resolved Config on 0.2.x, or the legacy
//      `livedocs` namespace registered with the DSH settings service on 0.1.x
//   3. project override — <projectRoot>/.dsh-livedocs.json (subset of fields)
//
// 0.2.x contract: the plugin exports `Config` (schemastery). cordis validates
// user settings and passes the resolved value to apply(ctx, config). The
// browser half receives the same namespace via configForms on the Plugins page.
//
// 0.1.x contract: the plugin registers a `livedocs` settings namespace through
// the host settings service; the settings card binds settingsScope.

import Schema from '@deepseek-ai/schemastery'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Settings namespace / configForms entry id; must match /^[a-z][a-z0-9-]*$/. */
export const LIVEDOCS_NS = 'livedocs'

/** File name of the per-project override document. */
export const PROJECT_CONFIG_FILE = '.dsh-livedocs.json'

/**
 * Mark a schemastery schema as volatile (editable live without reloading the
 * plugin instance). We test whether the local schemastery copy handles
 * `.volatile()` correctly — older versions (e.g. 3.18.2) drop defaults when
 * calling it, so on those hosts we skip volatile marking and rely on the
 * legacy settingsScope path instead.
 */
function markVolatile(schema) {
  if (typeof schema.volatile !== 'function') return schema
  // Verify `.volatile()` preserves defaults before adopting it.
  try {
    const probe = Schema.object({ __probe: Schema.boolean().default(true) }).volatile()
    if (probe({}).__probe === true) return schema.volatile()
  } catch { /* fall through */ }
  return schema
}

/**
 * Durable global schema — exported from index.js as `Config`. cordis resolves
 * user settings through it before apply() runs; the settings card edits the
 * same shape over the configForms wire.
 */
export const ConfigSchema = markVolatile(Schema.object({
  enabled: Schema.boolean()
    .default(true)
    .description('Master switch: tools, deps injection and prefetch.'),
  locale: Schema.union([Schema.const('zh'), Schema.const('en')])
    .default('zh')
    .description('Slash-command language (description/hint/usage): 中文 (zh) or English (en). The settings card itself follows the global UI language.'),
  injectDeps: Schema.boolean()
    .default(true)
    .description('Inject the installed-dependencies block into the system prompt.'),
  prefetch: Schema.boolean()
    .default(true)
    .description('Warm the docs cache for the top project deps in the background.'),
  skill: Schema.boolean()
    .default(true)
    .description('Register the embedded livedocs skill so the agent auto-loads usage rules when working with third-party libraries.'),
  prefetchTopN: Schema.number().min(0).max(10).step(1)
    .default(3)
    .description('How many top dependencies get prefetched per project.'),
  cacheTtlDays: Schema.number().min(1).max(90).step(1)
    .default(7)
    .description('Days a cached docs entry stays fresh before refetch.'),
  cacheMaxEntries: Schema.number().min(1).max(1000).step(1)
    .default(200)
    .description('Max cached docs entries; least recently used entries are evicted beyond this.'),
  customDocs: Schema.array(
    Schema.object({
      name: Schema.string().description('Library name this source answers for.'),
      url: Schema.string()
        .pattern(/^https:\/\//)
        .description('Absolute https URL of a llms.txt / markdown doc.'),
      version: Schema.string().description('Optional version this source documents.'),
    }),
  )
    .default([])
    .description('User-added documentation sources checked before the npm resolution chain.'),
  context7Key: Schema.string()
    .pattern(/^(ctx7sk[\w-]*)?$/)
    .role('secret')
    .default('')
    .description('Optional Context7 API key (ctx7sk…). When set, libraries with no llms.txt/README coverage fall back to the Context7 cloud index. Empty = disabled.'),
}))

/** Plain mirror of the schema defaults, used when no settings service exists. */
export const DEFAULT_CONFIG = ConfigSchema({})

/**
 * Fields that must never come from a project file: API credentials stay in
 * the user-global settings document so a committed .dsh-livedocs.json can
 * never leak a key into a repository.
 */
const PROJECT_OVERRIDE_EXCLUDE = new Set(['context7Key'])

/**
 * Merge a project-level override over the resolved global config.
 * Unknown keys are ignored; arrays/objects are replaced wholesale.
 * @param {object} globalConfig
 * @param {string|undefined} projectDir - project root to look in.
 * @returns {{config: object, projectFile: string|null, projectOverride: object|null}}
 */
export function resolveProjectConfig(globalConfig, projectDir) {
  if (!projectDir) return { config: { ...globalConfig }, projectFile: null, projectOverride: null }
  const file = join(projectDir, PROJECT_CONFIG_FILE)
  if (!existsSync(file)) return { config: { ...globalConfig }, projectFile: null, projectOverride: null }
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('top level must be an object')
    }
    const override = {}
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      if (PROJECT_OVERRIDE_EXCLUDE.has(key)) continue
      if (key in raw) override[key] = raw[key]
    }
    return { config: { ...globalConfig, ...override }, projectFile: file, projectOverride: override }
  } catch (err) {
    // A broken override must never break the plugin — serve global config.
    return { config: { ...globalConfig }, projectFile: file, projectOverride: null, error: String(err?.message ?? err) }
  }
}

/**
 * Unwrap schemastery volatile values (objects with a `.get()` method) back
 * to plain JSON so the rest of the plugin never has to know about volatile.
 */
function unwrapVolatile(value) {
  if (value && typeof value === 'object' && typeof value.get === 'function') {
    return unwrapVolatile(value.get())
  }
  if (Array.isArray(value)) return value.map(unwrapVolatile)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unwrapVolatile(v)]))
  }
  return value
}

/**
 * Merge the cordis-resolved config over schema defaults. Defensive: apply()
 * receives an already-validated value in production, but tests and exotic
 * loaders may call it without one. Volatile wrappers are unwrapped.
 * @param {object|undefined} config - second argument cordis passes to apply().
 */
export function mergeWithDefaults(config) {
  const plain = config ? unwrapVolatile(config) : {}
  return { ...DEFAULT_CONFIG, ...plain }
}

/**
 * Create a live config reader.
 *
 * Dual-era implementation:
 *   - 0.1.x hosts expose `settings.register(ns, schema, opts)`. We register the
 *     `livedocs` namespace and watch for changes.
 *   - 0.2.x hosts consume the exported `Config` schema; cordis passes the
 *     resolved value as `apply(ctx, config)` and emits `internal/config` when
 *     volatile fields change. We use that as the live source.
 *
 * @param {object} ctx - Cordis plugin context.
 * @param {object} [opts]
 * @param {object} [opts.cordisConfig] - resolved config from cordis (0.2.x path).
 * @returns {{ get: () => object, watch: (cb: (next: object) => void) => () => void, backed: () => boolean }}
 */
export function createConfigProvider(ctx, opts = {}) {
  let scope = null
  let backed = false
  const watchers = new Set()

  let unwatchScope = null
  ctx.on?.('dispose', () => {
    unwatchScope?.()
    unwatchScope = null
    watchers.clear()
  })

  const notify = (next) => {
    for (const cb of watchers) {
      try { cb(next) } catch { /* one broken watcher must not break others */ }
    }
  }

  // 0.2.x path: live config arrives via cordis Config + internal/config events.
  let liveConfig = mergeWithDefaults(opts.cordisConfig)

  ctx.on?.('internal/config', function (_raw, next) {
    if (this !== ctx.fiber) return next()
    const raw = next()
    liveConfig = mergeWithDefaults(raw)
    notify(liveConfig)
    return raw
  })

  const get = () => {
    if (scope) {
      try { return scope.get() } catch { /* fall through */ }
    }
    return { ...liveConfig }
  }

  ctx.inject?.(['settings'], (settingsCtx) => {
    const settings = settingsCtx.settings
    if (typeof settings?.register !== 'function') return // 0.2.x SettingsForms has no register; keep cordis path
    try {
      scope = settings.register(LIVEDOCS_NS, ConfigSchema, {
        applies: 'live',
        validate(value) {
          for (const doc of value.customDocs) {
            if (!/^https:\/\//.test(doc.url)) {
              throw new Error(`customDocs entry "${doc.name}" needs an https:// URL`)
            }
          }
          const key = value.context7Key?.trim()
          if (key && !key.startsWith('ctx7sk')) {
            throw new Error('Context7 API Key 应以 ctx7sk 开头（在 context7.com/dashboard 免费申请）；留空表示关闭')
          }
        },
      })
      backed = true
      unwatchScope = scope.watch((next) => {
        liveConfig = next
        notify(next)
      })
      ctx.logger?.info?.('dsh-livedocs: settings namespace "livedocs" registered')
    } catch (err) {
      ctx.logger?.warn?.(`dsh-livedocs: settings registration failed, using defaults: ${err?.message ?? err}`)
    }
  })

  return {
    get,
    backed: () => backed,
    watch(cb) {
      watchers.add(cb)
      return () => watchers.delete(cb)
    },
  }
}

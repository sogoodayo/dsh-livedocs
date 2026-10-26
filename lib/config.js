// dsh-livedocs configuration: host-resolved config + per-project override.
//
// Layering (lowest wins first):
//   1. schema defaults (DEFAULT_CONFIG)
//   2. global user settings — cordis-resolved Config on 0.2.x, or the legacy
//      `livedocs` namespace registered with the DSH settings service on 0.1.x
//   3. project override — <projectRoot>/.dsh-livedocs.json (subset of fields)
//
// 0.2.x contract: the plugin exports `Config` (schemastery) with volatile
// fields; cordis validates user settings and passes the resolved value to
// apply(ctx, config), with volatile fields as live `.get()` references.
// Writes go through the host settings service's update(ns, patch), which is
// signature-stable across 0.1.x and 0.2.x. (Pattern verified by dsh-code-ui.)

import Schema from '@deepseek-ai/schemastery'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Settings namespace / configForms entry id; must match /^[a-z][a-z0-9-]*$/. */
export const LIVEDOCS_NS = 'livedocs'

/** File name of the per-project override document. */
export const PROJECT_CONFIG_FILE = '.dsh-livedocs.json'

/**
 * Mark one field volatile (editable live without reloading the plugin).
 * `.volatile()` exists only on schemastery >=3.18.4 (bundled with 0.2.x
 * hosts); on older copies the field stays a plain static schema.
 */
function maybeVolatile(field) {
  return field && typeof field.volatile === 'function' ? field.volatile() : field
}

/**
 * Durable global schema — exported from index.js as `Config`. cordis resolves
 * user settings through it before apply() runs; on 0.2.x the settings service
 * serves the volatile fields to the Plugins page through configForms.
 */
export const ConfigSchema = Schema.object({
  enabled: maybeVolatile(Schema.boolean().default(true))
    .description('Master switch: tools, deps injection and prefetch.'),
  locale: maybeVolatile(Schema.union([Schema.const('zh'), Schema.const('en')]).default('zh'))
    .description('Slash-command language (description/hint/usage): 中文 (zh) or English (en). The settings card itself follows the global UI language.'),
  injectDeps: maybeVolatile(Schema.boolean().default(true))
    .description('Inject the installed-dependencies block into the system prompt.'),
  prefetch: maybeVolatile(Schema.boolean().default(true))
    .description('Warm the docs cache for the top project deps in the background.'),
  skill: maybeVolatile(Schema.boolean().default(true))
    .description('Register the embedded livedocs skill so the agent auto-loads usage rules when working with third-party libraries.'),
  prefetchTopN: maybeVolatile(Schema.number().min(0).max(10).step(1).default(3))
    .description('How many top dependencies get prefetched per project.'),
  cacheTtlDays: maybeVolatile(Schema.number().min(1).max(90).step(1).default(7))
    .description('Days a cached docs entry stays fresh before refetch.'),
  cacheMaxEntries: maybeVolatile(Schema.number().min(1).max(1000).step(1).default(200))
    .description('Max cached docs entries; least recently used entries are evicted beyond this.'),
  customDocs: maybeVolatile(Schema.array(
    Schema.object({
      name: Schema.string().description('Library name this source answers for.'),
      url: Schema.string()
        .pattern(/^https:\/\//)
        .description('Absolute https URL of a llms.txt / markdown doc.'),
      version: Schema.string().description('Optional version this source documents.'),
    }),
  ).default([]))
    .description('User-added documentation sources checked before the npm resolution chain.'),
  context7Key: maybeVolatile(Schema.string()
    .pattern(/^(ctx7sk[\w-]*)?$/)
    .role('secret')
    .default(''))
    .description('Optional Context7 API key (ctx7sk…). When set, libraries with no llms.txt/README coverage fall back to the Context7 cloud index. Empty = disabled.'),
})

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

/** Plain mirror of the schema defaults, used when no settings service exists. */
export const DEFAULT_CONFIG = unwrapVolatile(ConfigSchema({}))

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
 * Create a live config reader/writer.
 *
 * Dual-era implementation (mirrors dsh-code-ui):
 *   - 0.1.x hosts expose `settings.register(ns, schema, opts)`. We register the
 *     `livedocs` namespace and watch for changes.
 *   - 0.2.x hosts consume the exported `Config` schema; cordis passes the
 *     resolved value as `apply(ctx, config)` with volatile fields as live
 *     `.get()` references. Updates arrive via `loader/volatile-update` (this
 *     plugin's ctx) and `settings/document-updated` (root ctx).
 *   - Writes go through `settings.update(ns, patch)` — present with the same
 *     signature on both generations.
 *
 * @param {object} ctx - Cordis plugin context.
 * @param {object} [opts]
 * @param {object} [opts.cordisConfig] - resolved config from cordis (0.2.x path).
 * @returns {{ get: () => object, set: (patch: object) => Promise<object>, watch: (cb: (next: object) => void) => () => void, backed: () => boolean }}
 */
export function createConfigProvider(ctx, opts = {}) {
  let scope = null
  let backed = false
  let settingsRef = null
  const watchers = new Set()

  let unwatchScope = null
  ctx.on?.('dispose', () => {
    unwatchScope?.()
    unwatchScope = null
    watchers.clear()
  })

  const get = () => {
    if (scope) {
      try { return unwrapVolatile(scope.get()) } catch { /* fall through */ }
    }
    return readCordis()
  }
  const notify = () => {
    const next = get()
    for (const cb of watchers) {
      try { cb(next) } catch { /* one broken watcher must not break others */ }
    }
  }

  // 0.2.x path baseline: the cordis-resolved plugin config with volatile refs.
  const pluginConfig = opts.cordisConfig
  const readCordis = () => {
    const cfg = pluginConfig && typeof pluginConfig === 'object' ? pluginConfig : {}
    const out = {}
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      const field = cfg[key]
      const value = field && typeof field.get === 'function' ? field.get() : field
      out[key] = value ?? DEFAULT_CONFIG[key]
    }
    return out
  }

  ctx.inject?.(['settings'], (settingsCtx) => {
    const settings = settingsCtx.settings
    settingsRef = settings
    if (typeof settings?.register !== 'function') {
      // 0.2.x: register() is gone — the exported Config IS the registration.
      // Volatile refs update in place on HMR; volatile-update reaches this
      // plugin's ctx, document-updated is emitted on the root.
      ctx.on?.('loader/volatile-update', notify)
      ctx.root?.on?.('settings/document-updated', (ns) => { if (ns === LIVEDOCS_NS) notify() })
      backed = true
      return
    }
    // 0.1.x path: manual namespace registration + scope watch.
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
      unwatchScope = scope.watch(notify)
      ctx.logger?.info?.('dsh-livedocs: settings namespace "livedocs" registered')
    } catch (err) {
      ctx.logger?.warn?.(`dsh-livedocs: settings registration failed, using defaults: ${err?.message ?? err}`)
    }
  })

  /**
   * Apply a partial config patch through the host settings service
   * (update(ns, patch) is signature-stable across 0.1.x and 0.2.x).
   * @param {object} patch
   * @returns {Promise<object>} merged config after the write
   */
  const set = async (patch) => {
    if (settingsRef && typeof settingsRef.update === 'function') {
      await settingsRef.update(LIVEDOCS_NS, patch ?? {})
      notify()
      return get()
    }
    throw new Error('settings service unavailable')
  }

  return {
    get,
    set,
    backed: () => backed,
    watch(cb) {
      watchers.add(cb)
      return () => watchers.delete(cb)
    },
  }
}

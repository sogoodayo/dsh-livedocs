// dsh-livedocs configuration: host-resolved config + per-project override.
//
// Layering (lowest wins first):
//   1. schema defaults (DEFAULT_CONFIG)
//   2. global user settings — the `livedocs` section of the DSH settings
//      document, editable from 设置 → 插件 → 插件配置 (settings form is
//      projected automatically from the exported Config schema)
//   3. project override — <projectRoot>/.dsh-livedocs.json (subset of fields)
//
// dsh 0.2.x contract: the plugin module exports `Config` (a schemastery
// schema); cordis validates user settings against it and hands the resolved
// value to apply(ctx, config). There is no client-side settings service to
// register with anymore — Config IS the registration.

import Schema from '@deepseek-ai/schemastery'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Settings namespace / configForms entry id; must match /^[a-z][a-z0-9-]*$/. */
export const LIVEDOCS_NS = 'livedocs'

/** File name of the per-project override document. */
export const PROJECT_CONFIG_FILE = '.dsh-livedocs.json'

/**
 * Durable global schema — exported from index.js as `Config`. cordis resolves
 * user settings through it before apply() runs; the settings card edits the
 * same shape over the configForms wire.
 */
export const ConfigSchema = Schema.object({
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
})

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
 * Merge the cordis-resolved config over schema defaults. Defensive: apply()
 * receives an already-validated value in production, but tests and exotic
 * loaders may call it without one.
 * @param {object|undefined} config - second argument cordis passes to apply().
 */
export function mergeWithDefaults(config) {
  return { ...DEFAULT_CONFIG, ...(config ?? {}) }
}

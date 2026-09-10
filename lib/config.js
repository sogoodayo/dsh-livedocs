// dsh-livedocs configuration: global settings namespace + per-project override.
//
// Layering (lowest wins first):
//   1. schema defaults (DEFAULT_CONFIG)
//   2. global user settings — the `livedocs` namespace in the DSH settings
//      document, editable from 设置 → 插件 → 插件配置
//   3. project override — <projectRoot>/.dsh-livedocs.json (subset of fields)
//
// The settings service is optional: when a profile does not provide it the
// provider transparently serves defaults, so every feature keeps working.

import Schema from '@deepseek-ai/schemastery'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Settings namespace; must match /^[a-z][a-z0-9-]*$/. */
export const LIVEDOCS_NS = 'livedocs'

/** File name of the per-project override document. */
export const PROJECT_CONFIG_FILE = '.dsh-livedocs.json'

/** Durable global schema — also the wire shape the settings card edits. */
export const ConfigSchema = Schema.object({
  enabled: Schema.boolean()
    .default(true)
    .description('Master switch: tools, deps injection and prefetch.'),
  injectDeps: Schema.boolean()
    .default(true)
    .description('Inject the installed-dependencies block into the system prompt.'),
  prefetch: Schema.boolean()
    .default(true)
    .description('Warm the docs cache for the top project deps in the background.'),
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
      url: Schema.string().description('Absolute https URL of a llms.txt / markdown doc.'),
      version: Schema.string().description('Optional version this source documents.'),
    }),
  )
    .default([])
    .description('User-added documentation sources checked before the npm resolution chain.'),
})

/** Plain mirror of the schema defaults, used when no settings service exists. */
export const DEFAULT_CONFIG = ConfigSchema({})

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
      if (key in raw) override[key] = raw[key]
    }
    return { config: { ...globalConfig, ...override }, projectFile: file, projectOverride: override }
  } catch (err) {
    // A broken override must never break the plugin — serve global config.
    return { config: { ...globalConfig }, projectFile: file, projectOverride: null, error: String(err?.message ?? err) }
  }
}

/**
 * Register the global `livedocs` settings namespace when the host provides the
 * settings service, and hand back a live config reader. Falls back to static
 * defaults otherwise. Never throws — a settings failure must not block loading.
 * @param {object} ctx - Cordis plugin context.
 * @returns {{ get: () => object, watch: (cb: (next: object) => void) => () => void, backed: () => boolean }}
 */
export function createConfigProvider(ctx) {
  let scope = null
  let backed = false
  const watchers = new Set()

  const get = () => {
    if (!scope) return { ...DEFAULT_CONFIG }
    try {
      return scope.get()
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  ctx.inject(['settings'], (settingsCtx) => {
    try {
      scope = settingsCtx.settings.register(LIVEDOCS_NS, ConfigSchema, {
        applies: 'live',
        validate(value) {
          for (const doc of value.customDocs) {
            if (!/^https:\/\//.test(doc.url)) {
              throw new Error(`customDocs entry "${doc.name}" needs an https:// URL`)
            }
          }
        },
      })
      backed = true
      scope.watch((next) => {
        for (const cb of watchers) {
          try {
            cb(next)
          } catch {
            // one broken watcher must not break the others
          }
        }
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

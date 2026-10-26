// Typert remote surface for the dsh-livedocs settings card.
//
// The web UI card (client.js) talks to the Host through these endpoints to
// manage the docs cache and the plugin config. Plain class + manual
// `typertRemote` binding, registered through `ctx.root.reflect.provide()` —
// the gateway's SRC-mode discovery scans reflect services, so late-loaded
// plugins are picked up without any Typert codegen. (Same pattern as
// dsh-code-ui, verified working on both DSH 0.1.x and 0.2.x hosts.)
//
// Decorator syntax is unavailable in plain ESM, so @Remote markers are
// applied manually through the same public decorator entry (see markRemote).

import { Remote, bindTypertRemote } from '@deepseek-ai/dsh-typert-protocol'
import { checkForUpdate } from './update.js'

/**
 * Apply the @Remote direct marker to one prototype method, replicating what
 * the decorator's addInitializer does at construction time.
 * @param {object} proto - class prototype owning the method.
 * @param {string} name - public instance method name.
 */
function markRemote(proto, name) {
  Remote(proto[name], {
    private: false,
    static: false,
    name,
    addInitializer(init) {
      init.call(Object.create(proto))
    },
  })
}

/** Wire namespace exposed to the settings card (endpoints: `livedocs/<method>`). */
export const LIVEDOCS_REMOTE_NAMESPACE = 'livedocs'

/**
 * Host owner of the `livedocs` Remote namespace.
 *
 * NOTE: every member must be a plain property, NOT a #private field or WeakMap
 * keyed by instance: the gateway invokes remote methods through cordis proxies,
 * and proxies carry neither private-field brands nor WeakMap identity.
 */
export class LivedocsController {
  /**
   * @param {{ cache: import('./cache.js').DocsCache, selfVersion?: string, fetchImpl?: typeof fetch, getConfig?: () => object, getBacked?: () => boolean, setConfig?: (patch: object) => Promise<object> }} internals
   */
  constructor(internals) {
    // Visible binding consumed by the gateway's source-mode discovery.
    this.typertRemote = bindTypertRemote(this, LIVEDOCS_REMOTE_NAMESPACE)
    /** @type {import('./cache.js').DocsCache} */
    this.cache = internals.cache
    this.selfVersion = internals.selfVersion ?? '0.0.0-dev'
    this.fetchImpl = internals.fetchImpl ?? fetch
    // Config accessors for the settings card.
    this.getConfigImpl = internals.getConfig
    this.getBackedImpl = internals.getBacked
    this.setConfigImpl = internals.setConfig
  }

  /**
   * List every cached docs entry, freshest access first.
   * @returns {{ entries: Array<object>, totalBytes: number }}
   */
  listDocs() {
    const entries = this.cache.list()
    return { entries, totalBytes: entries.reduce((sum, e) => sum + e.size, 0) }
  }

  /**
   * Remove one cached docs entry by its cache key.
   * @param {object} args - `{ key }`: exact cache key from listDocs().
   * @returns {{ removed: boolean }}
   */
  removeDoc(args) {
    const key = args?.key
    if (typeof key !== 'string' || !key) return { removed: false }
    return { removed: this.cache.remove(key) }
  }

  /**
   * Clear the whole docs cache.
   * @returns {{ cleared: boolean }}
   */
  clearDocs() {
    this.cache.clear()
    return { cleared: true }
  }

  /**
   * Current resolved global config for the settings card.
   * @returns {{ config: object, backed: boolean }}
   */
  getConfig() {
    return { config: this.getConfigImpl?.() ?? {}, backed: this.getBackedImpl?.() ?? false }
  }

  /**
   * Apply a partial config patch; returns the merged config.
   * The client wraps payloads in `{ args }` (connection.rpc convention), so
   * the wire parameter name must be `args`.
   * @param {object} args - the patch: subset of schema fields to change.
   * @returns {Promise<{ config: object, error?: string }>}
   */
  async setConfig(args) {
    try {
      const config = await this.setConfigImpl?.(args)
      return { config: config ?? {} }
    } catch (err) {
      return { config: this.getConfigImpl?.() ?? {}, error: String(err?.message ?? err) }
    }
  }

  /**
   * Check the npm registry for a newer release of this plugin.
   * @returns {Promise<{current: string, latest?: string, updateAvailable?: boolean, command?: string, error?: string}>}
   */
  checkUpdate() {
    return checkForUpdate({
      name: 'dsh-livedocs',
      current: this.selfVersion,
      fetchImpl: this.fetchImpl,
    })
  }
}

markRemote(LivedocsController.prototype, 'listDocs')
markRemote(LivedocsController.prototype, 'removeDoc')
markRemote(LivedocsController.prototype, 'clearDocs')
markRemote(LivedocsController.prototype, 'getConfig')
markRemote(LivedocsController.prototype, 'setConfig')
markRemote(LivedocsController.prototype, 'checkUpdate')

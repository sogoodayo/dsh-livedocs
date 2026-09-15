// Typert remote surface for the dsh-livedocs settings card.
//
// The web UI card (client.js) talks to the Host through these endpoints to
// list and prune the docs cache — dynamic data that cannot ride the settings
// document. No code generator is needed: the gateway's SRC mode reflects on
// the live service's method signatures and validates nothing beyond JSON
// shape (codec mode "src-json"), so plain-JS plugins can expose remotes too.
//
// Decorator syntax is unavailable in plain ESM, so @Remote markers are
// applied manually through the same public decorator entry (see markRemote).

import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
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

/** Wire namespace exposed to the settings card. */
export const LIVEDOCS_REMOTE_NAMESPACE = 'livedocs'

/**
 * Host owner of the `livedocs` Remote namespace.
 * Constructed with the plugin's cache so the card can manage it.
 *
 * NOTE: the cache is a plain property, NOT a #private field or WeakMap keyed
 * by instance: the gateway invokes remote methods through cordis proxies,
 * and proxies carry neither private-field brands nor WeakMap identity.
 * (Official controllers do the same — TypeScript `private` compiles to a
 * plain property, which is proxy-safe.)
 */
export class LivedocsController extends TypertRemoteService {
  /**
   * @param {import('@deepseek-ai/cordis').Context} ctx - Host plugin context.
   * @param {{ cache: import('./cache.js').DocsCache, selfVersion?: string, fetchImpl?: typeof fetch }} internals
   */
  constructor(ctx, internals) {
    super(ctx, 'livedocsController', { namespace: LIVEDOCS_REMOTE_NAMESPACE })
    /** @type {import('./cache.js').DocsCache} */
    this.cache = internals.cache
    // Plain properties, NOT #private: the gateway calls these methods through
    // cordis proxies (see class doc above).
    this.selfVersion = internals.selfVersion ?? '0.0.0-dev'
    this.fetchImpl = internals.fetchImpl ?? fetch
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
   * @param {string} key - exact cache key from listDocs().
   * @returns {{ removed: boolean }}
   */
  removeDoc(key) {
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
markRemote(LivedocsController.prototype, 'checkUpdate')

// JSON-file LRU cache with TTL. Zero native dependencies.
// Storage layout: <dir>/index.json  →  { [key]: { file, fetchedAt, accessedAt, size, stale } }
//                   <dir>/blobs/<hash>.md

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_TTL_MS = 7 * 24 * 3600 * 1000 // 7 days
const DEFAULT_MAX_ENTRIES = 200

export class DocsCache {
  constructor(dir, { ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
    this.dir = dir
    this.blobsDir = join(dir, 'blobs')
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
    mkdirSync(this.blobsDir, { recursive: true })
    this.indexPath = join(dir, 'index.json')
    this.index = this.#loadIndex()
  }

  #loadIndex() {
    try {
      return JSON.parse(readFileSync(this.indexPath, 'utf8'))
    } catch {
      return {}
    }
  }

  #saveIndex() {
    writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2))
  }

  #hash(key) {
    return createHash('sha256').update(key).digest('hex').slice(0, 24)
  }

  /**
   * @returns {{ content: string, stale: boolean, fetchedAt: number } | null}
   */
  get(key, { allowStale = false } = {}) {
    const entry = this.index[key]
    if (!entry) return null
    const blobPath = join(this.blobsDir, entry.file)
    if (!existsSync(blobPath)) {
      delete this.index[key]
      this.#saveIndex()
      return null
    }
    const age = Date.now() - entry.fetchedAt
    const stale = age > this.ttlMs
    if (stale && !allowStale) return null
    entry.accessedAt = Date.now()
    this.#saveIndex()
    return { content: readFileSync(blobPath, 'utf8'), stale, fetchedAt: entry.fetchedAt }
  }

  set(key, content) {
    const file = this.#hash(key) + '.md'
    writeFileSync(join(this.blobsDir, file), content)
    this.index[key] = {
      file,
      fetchedAt: Date.now(),
      accessedAt: Date.now(),
      size: Buffer.byteLength(content),
    }
    this.#evict()
    this.#saveIndex()
  }

  #evict() {
    const keys = Object.keys(this.index)
    if (keys.length <= this.maxEntries) return
    keys
      .sort((a, b) => this.index[a].accessedAt - this.index[b].accessedAt)
      .slice(0, keys.length - this.maxEntries)
      .forEach((k) => this.#remove(k))
  }

  #remove(key) {
    const entry = this.index[key]
    if (!entry) return
    const blobPath = join(this.blobsDir, entry.file)
    if (existsSync(blobPath)) unlinkSync(blobPath)
    delete this.index[key]
  }

  /**
   * Remove one entry by cache key (public counterpart used by the remote API).
   * @returns {boolean} whether an entry existed.
   */
  remove(key) {
    const existed = key in this.index
    this.#remove(key)
    if (existed) this.#saveIndex()
    return existed
  }

  /**
   * List cache entries with parsed display fields, freshest access first.
   * @returns {Array<{key: string, library: string, version: string, sourceUrl: string,
   *   size: number, fetchedAt: number, accessedAt: number, stale: boolean}>}
   */
  list() {
    return Object.entries(this.index)
      .map(([key, entry]) => {
        const sep = key.indexOf('|')
        const id = sep === -1 ? key : key.slice(0, sep)
        const at = id.lastIndexOf('@')
        return {
          key,
          library: at > 0 ? id.slice(0, at) : id,
          version: at > 0 ? id.slice(at + 1) : 'latest',
          sourceUrl: sep === -1 ? '' : key.slice(sep + 1),
          size: entry.size,
          fetchedAt: entry.fetchedAt,
          accessedAt: entry.accessedAt,
          stale: Date.now() - entry.fetchedAt > this.ttlMs,
        }
      })
      .sort((a, b) => b.accessedAt - a.accessedAt)
  }

  clear() {
    for (const key of Object.keys(this.index)) this.#remove(key)
    this.#saveIndex()
  }

  stats() {
    const entries = Object.values(this.index)
    return {
      entries: entries.length,
      totalBytes: entries.reduce((s, e) => s + e.size, 0),
      oldestFetchedAt: entries.length ? Math.min(...entries.map((e) => e.fetchedAt)) : null,
      dir: this.dir,
    }
  }
}

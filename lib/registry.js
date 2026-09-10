// Curated package registry: which libraries are worth prefetching docs for,
// and (where verified) the best doc source URL for them.
//
// Two tiers:
//   - entries with `url` — a verified llms.txt source; resolution short-
//     circuits the npm chain and fetches this URL directly
//   - entries without    — priority signal only; prefetch tries these first,
//     resolution still walks the standard degradation chain

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

let cached = null

/**
 * Load the curated registry (bundled registry.json, read once per process).
 * @returns {{ packages: Record<string, { url?: string }> }}
 */
export function loadRegistry() {
  if (cached) return cached
  try {
    const file = join(dirname(fileURLToPath(import.meta.url)), 'registry.json')
    cached = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    cached = { packages: {} }
  }
  return cached
}

/**
 * Look up a package in the curated registry (case-insensitive).
 * @param {string} name - npm package name.
 * @returns {{ url?: string } | null}
 */
export function registryEntry(name) {
  const packages = loadRegistry().packages
  if (packages[name]) return packages[name]
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(packages)) {
    if (key.toLowerCase() === lower) return value
  }
  return null
}

/**
 * Stable partition: curated deps first, declaration order preserved within
 * each group. Used to rank the prefetch queue.
 * @param {Array<{name: string}>} deps
 * @returns {Array<{name: string}>}
 */
export function rankDeps(deps) {
  return [...deps].sort((a, b) => Number(!!registryEntry(b.name)) - Number(!!registryEntry(a.name)))
}

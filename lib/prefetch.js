// Docs prefetch: warm the cache for a project's most relevant dependencies.
//
// Selection strategy (v2): declaration order is a poor proxy for importance,
// so instead of "the first N declared deps" we walk the full dependency list
// and keep going until N packages are WARM (already cached or freshly
// fetched). Packages that resolve to nothing (private/intranet packages,
// unpublished names) or whose sources all fail simply don't consume a slot.
// Attempts are bounded so a project full of private packages doesn't turn
// into dozens of doomed registry calls.

/**
 * @param {Array<{name: string, version: string|null}>} deps - project deps in priority order.
 * @param {number} want - how many packages should end up warm (prefetchTopN).
 * @param {object} io
 * @param {(name: string) => Promise<object|null>} io.resolveLibrary
 * @param {(resolved: object, opts: {version: string|null}) => Promise<object|null>} io.fetchDocs
 * @param {{get: (key: string) => unknown, set: (key: string, content: string) => void}} io.cache
 * @param {(resolved: object, version: string|null) => string} io.cacheKey
 * @returns {Promise<{warmed: string[], attempted: number}>}
 */
export async function prefetchDeps(deps, want, io) {
  const warmed = []
  if (want <= 0) return { warmed, attempted: 0 }
  // Extra attempts cover private packages and dead sources without
  // letting a pathological dependency list spam the registry.
  const maxAttempts = want + 7
  let attempted = 0
  for (const dep of deps) {
    if (warmed.length >= want || attempted >= maxAttempts) break
    attempted++
    try {
      const resolved = await io.resolveLibrary(dep.name)
      if (!resolved) continue
      const version = dep.version ?? resolved.version
      const key = io.cacheKey(resolved, version)
      if (io.cache.get(key)) {
        warmed.push(dep.name)
        continue
      }
      const fetched = await io.fetchDocs(resolved, { version })
      if (fetched) {
        io.cache.set(key, fetched.content)
        warmed.push(dep.name)
      }
    } catch {
      // best-effort: one package's failure must not stop the rest
    }
  }
  return { warmed, attempted }
}

// Update check for the plugin itself: compare the running version against
// the latest release on the npm registry. Pure logic, no Host dependencies —
// fetch is injected so tests can stub the network.

const REGISTRY_BASE = 'https://registry.npmjs.org'

/**
 * Compare two x.y.z versions. Pre-release suffixes are ignored on purpose:
 * this plugin publishes plain semver only.
 * @returns {number} negative when a < b, 0 when equal, positive when a > b.
 */
export function compareVersions(a, b) {
  const pa = String(a ?? '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b ?? '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Ask the npm registry for the latest published version of the package and
 * compare it with the version currently running.
 *
 * @param {object} options
 * @param {string} options.name - npm package name (plain or @scoped/name).
 * @param {string} options.current - version currently running.
 * @param {typeof fetch} [options.fetchImpl] - injectable fetch for tests.
 * @returns {Promise<{current: string, latest?: string, updateAvailable?: boolean, command?: string, error?: string}>}
 */
export async function checkForUpdate({ name, current, fetchImpl = fetch }) {
  const url = `${REGISTRY_BASE}/${encodeURIComponent(name).replace('%40', '@')}/latest`
  let latest
  try {
    const res = await fetchImpl(url)
    if (!res.ok) return { current, error: `registry responded ${res.status}` }
    const data = await res.json()
    latest = typeof data?.version === 'string' ? data.version : null
    if (!latest) return { current, error: 'registry response has no version' }
  } catch (err) {
    return { current, error: String(err?.message ?? err) }
  }
  const updateAvailable = compareVersions(latest, current) > 0
  return {
    current,
    latest,
    updateAvailable,
    // Re-installing the package name pulls the latest release — same command
    // the Marketplace runs on install.
    command: updateAvailable ? `dsh plugin --profile web add ${name}` : undefined,
  }
}

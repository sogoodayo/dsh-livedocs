// Project dependency scanning for context injection and docs prefetching.
// Pure Node, no DSH imports — unit-testable outside the harness.

import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { detectInstalledVersion } from './lockfile.js'

/**
 * Walk up from `cwd` to find the nearest directory containing package.json.
 * Stops at the filesystem root or after `maxLevels` hops.
 * @returns {string|null}
 */
export function findProjectRoot(cwd, maxLevels = 10) {
  let dir = cwd
  for (let i = 0; i < maxLevels; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}

/**
 * List declared dependencies with their actually-installed versions.
 * @param {string} projectDir
 * @param {number} max how many deps to return (dependencies before devDependencies)
 * @returns {Array<{ name: string, version: string|null, dev: boolean }>}
 */
export function listProjectDeps(projectDir, max = 8) {
  let pkg
  try {
    pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'))
  } catch {
    return []
  }
  const out = []
  for (const [field, dev] of [['dependencies', false], ['devDependencies', true]]) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      if (out.length >= max) return out
      // Skip internal monorepo links — public docs don't exist for these
      if (typeof range === 'string' && /^(workspace|link|file):/.test(range)) continue
      // Skip type stubs — their docs live in the runtime package
      if (name.startsWith('@types/')) continue
      out.push({ name, version: detectInstalledVersion(projectDir, name).version, dev })
    }
  }
  return out
}

/**
 * Render the compact dependency block for system-prompt injection.
 * Kept deliberately short — it rides along on every request.
 * @param {Array<{ name: string, version: string|null, dev: boolean }>} deps
 */
export function formatDepsBlock(deps) {
  if (!deps.length) return ''
  const list = deps
    .map((d) => `${d.name}@${d.version ?? '?'}${d.dev ? ' (dev)' : ''}`)
    .join(', ')
  return (
    `[dsh-livedocs] Project dependencies (installed versions): ${list}. ` +
    `Before writing code against any of these APIs, call docs_query with this ` +
    `project's path as projectDir to pull version-matched official docs.`
  )
}

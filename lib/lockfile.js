// Detect the actually-installed version of a package in a project.
// Zero-dependency strategy, in order of reliability:
//   1. node_modules/<pkg>/package.json → version field (exact, package-manager agnostic)
//   2. package-lock.json               → packages["node_modules/<pkg>"].version
//   3. node_modules/.pnpm/<pkg>@<ver>/ (pnpm global-store layout fallback)
//   4. package.json dependencies range (a range, not an exact version — last resort)
//
// Pure Node, no DSH imports — unit-testable outside the harness.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @param {string} projectDir absolute path to the project root
 * @param {string} packageName e.g. "react" or "@tanstack/react-query"
 * @returns {{ version: string|null, source: string, range: string|null }}
 */
export function detectInstalledVersion(projectDir, packageName) {
  const range = readDeclaredRange(projectDir, packageName)

  // 1. node_modules/<pkg>/package.json — works for npm / pnpm / yarn alike
  const installedPkg = join(projectDir, 'node_modules', ...packageName.split('/'), 'package.json')
  const fromModules = readVersionField(installedPkg)
  if (fromModules) return { version: fromModules, source: 'node_modules', range }

  // 2. package-lock.json
  const fromLock = readPackageLock(projectDir, packageName)
  if (fromLock) return { version: fromLock, source: 'package-lock.json', range }

  // 3. pnpm store layout: node_modules/.pnpm/<name>@<version>
  const fromPnpm = readPnpmStore(projectDir, packageName)
  if (fromPnpm) return { version: fromPnpm, source: 'pnpm-store', range }

  // 4. declared range only (e.g. "^19.0.0") — better than nothing
  if (range) return { version: null, source: 'package.json-range', range }

  return { version: null, source: 'not-found', range: null }
}

function readVersionField(pkgJsonPath) {
  try {
    if (!existsSync(pkgJsonPath)) return null
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
    return typeof pkg.version === 'string' ? pkg.version : null
  } catch {
    return null
  }
}

function readDeclaredRange(projectDir, packageName) {
  try {
    const pkgPath = join(projectDir, 'package.json')
    if (!existsSync(pkgPath)) return null
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const range = pkg[field]?.[packageName]
      if (typeof range === 'string') return range
    }
    return null
  } catch {
    return null
  }
}

function readPackageLock(projectDir, packageName) {
  try {
    const lockPath = join(projectDir, 'package-lock.json')
    if (!existsSync(lockPath)) return null
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
    const entry = lock.packages?.[`node_modules/${packageName}`]
    return typeof entry?.version === 'string' ? entry.version : null
  } catch {
    return null
  }
}

function readPnpmStore(projectDir, packageName) {
  try {
    const storeDir = join(projectDir, 'node_modules', '.pnpm')
    if (!existsSync(storeDir)) return null
    // pnpm encodes scoped packages as @scope+name@version
    const prefix = packageName.replace('/', '+') + '@'
    const match = readdirSync(storeDir)
      .filter((d) => d.startsWith(prefix))
      .sort()
      .pop() // highest version wins if several are present
    return match ? match.slice(prefix.length) : null
  } catch {
    return null
  }
}

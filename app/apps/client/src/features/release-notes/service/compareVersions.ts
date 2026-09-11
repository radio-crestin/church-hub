/**
 * Compares two version strings the way semver does. A leading "v" is
 * tolerated, and whatever is not a number in the core part counts as 0.
 *
 * Returns > 0 if `a` is newer, < 0 if older, 0 if equal.
 *
 * A pre-release sorts before the release it leads up to (`1.2.0-beta.1 <
 * 1.2.0`). Two pre-releases are compared identifier by identifier: numbers
 * numerically, words alphabetically, a number before a word, and the
 * shorter list first (`beta < beta.1`). Build metadata after "+" is
 * ignored, as semver says.
 *
 * The desktop app lets the updater plugin compare versions in Rust; this
 * is for the browser and for sorting release notes.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parse(a)
  const pb = parse(b)

  for (let i = 0; i < 3; i++) {
    const diff = pa.core[i] - pb.core[i]
    if (diff !== 0) return diff
  }
  return comparePrerelease(pa.prerelease, pb.prerelease)
}

interface ParsedVersion {
  core: [number, number, number]
  prerelease: string[]
}

function parse(version: string): ParsedVersion {
  const cleaned = version.trim().replace(/^v/i, '').split('+')[0]
  const dash = cleaned.indexOf('-')
  const corePart = dash === -1 ? cleaned : cleaned.slice(0, dash)
  const prereleasePart = dash === -1 ? '' : cleaned.slice(dash + 1)

  const numbers = corePart.split('.').map((part) => {
    const value = Number.parseInt(part, 10)
    return Number.isFinite(value) ? value : 0
  })
  return {
    core: [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0],
    prerelease: prereleasePart ? prereleasePart.split('.') : [],
  }
}

function comparePrerelease(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0
  // A release outranks any pre-release of the same core version.
  if (a.length === 0) return 1
  if (b.length === 0) return -1

  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    if (a[i] === undefined) return -1
    if (b[i] === undefined) return 1
    const diff = compareIdentifier(a[i], b[i])
    if (diff !== 0) return diff
  }
  return 0
}

function compareIdentifier(a: string, b: string): number {
  const numericA = /^\d+$/.test(a) ? Number(a) : null
  const numericB = /^\d+$/.test(b) ? Number(b) : null
  if (numericA !== null && numericB !== null) return numericA - numericB
  if (numericA !== null) return -1
  if (numericB !== null) return 1
  if (a === b) return 0
  return a < b ? -1 : 1
}

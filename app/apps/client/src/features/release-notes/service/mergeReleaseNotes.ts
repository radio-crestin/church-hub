import { compareVersions } from './compareVersions'
import type { VersionNotes } from '../types'

function hasContent(notes: VersionNotes): boolean {
  return (
    notes.features.length + notes.bugFixes.length + notes.changes.length > 0
  )
}

/**
 * Merges the bundled (offline) changelog with notes fetched from GitHub.
 *
 * The bundled data is the source of truth for versions it covers (structured,
 * reliable). GitHub contributes versions newer than the build — i.e. an
 * update the user hasn't installed yet — so they still see what's coming, and
 * the written notes of a version this build only has the commits of.
 */
export function mergeReleaseNotes(
  bundled: VersionNotes[],
  remote: VersionNotes[],
): VersionNotes[] {
  const byVersion = new Map<string, VersionNotes>()
  for (const notes of bundled) byVersion.set(notes.version, notes)

  for (const notes of remote) {
    const local = byVersion.get(notes.version)
    if (!local) {
      if (hasContent(notes)) byVersion.set(notes.version, notes)
    } else if (!local.written && notes.written) {
      // Written in the release CI after this build was made.
      byVersion.set(notes.version, { ...local, written: notes.written })
    }
  }

  return Array.from(byVersion.values()).sort((a, b) =>
    compareVersions(b.version, a.version),
  )
}

/**
 * A single categorized change within a released version.
 * `scope` is the conventional-commit scope (e.g. "auth", "songs"), or null.
 */
export interface ChangeEntry {
  scope: string | null
  message: string
}

/**
 * The release notes for one application version. Generated from git history
 * (see app/scripts/generate-changelog.ts) and bundled into the app as
 * changelog.json, optionally augmented at runtime from the GitHub Releases API.
 */
export interface VersionNotes {
  version: string
  date: string | null
  features: ChangeEntry[]
  bugFixes: ChangeEntry[]
  changes: ChangeEntry[]
}

export type ChangeCategory = 'features' | 'bugFixes' | 'changes'

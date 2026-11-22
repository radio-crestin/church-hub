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
  /**
   * The same version told plainly for the people using the app, written by
   * Claude in the release CI (app/scripts/write-release-notes.ts). Shown
   * instead of the commit list when present.
   */
  written?: WrittenNotes
}

/** Plain-language notes, one sentence per item. */
export interface WrittenNotesInLanguage {
  features: string[]
  bugFixes: string[]
}

export interface WrittenNotes {
  en: WrittenNotesInLanguage
  ro: WrittenNotesInLanguage
}

export type WrittenNotesLanguage = keyof WrittenNotes

export type ChangeCategory = 'features' | 'bugFixes' | 'changes'

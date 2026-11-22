#!/usr/bin/env bun
/**
 * Keeps the notes Claude wrote for a release (write-release-notes.ts, in the
 * release body) in the repo, so every later build bundles them and Settings >
 * About shows them offline. Run by the release CI's sync-version-back job,
 * before generate-changelog.ts, with the published release's body.
 *
 * Usage:
 *   gh release view v0.1.105 --json body -q .body > body.md
 *   bun app/scripts/save-written-notes.ts 0.1.105 body.md
 *
 * A body without written notes (none were written) changes nothing.
 */

import { readFileSync, writeFileSync } from 'node:fs'

import { readWrittenNotes, WRITTEN_NOTES_FILE } from './written-notes-file'
import { readWrittenNotesBlock } from '../apps/client/src/features/release-notes/service/writtenNotesBlock'

const [version, bodyFile] = process.argv.slice(2)
if (!version || !bodyFile) {
  console.error('usage: save-written-notes.ts <version> <release body file>')
  process.exit(1)
}

const notes = readWrittenNotesBlock(readFileSync(bodyFile, 'utf-8'))
if (!notes) {
  console.log(`The v${version} release has no written notes: nothing to save.`)
  process.exit(0)
}

const all = readWrittenNotes()
all[version.replace(/^v/, '')] = notes
writeFileSync(WRITTEN_NOTES_FILE, `${JSON.stringify(all, null, 2)}\n`)
console.log(`Saved the v${version} written notes to ${WRITTEN_NOTES_FILE}`)

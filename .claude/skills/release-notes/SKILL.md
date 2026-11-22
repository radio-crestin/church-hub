---
name: release-notes
description: Write a Church Hub version's release notes in plain English and Romanian before bumping it (scripts/release.sh refuses a version without them). Use when cutting a release, when release.sh says "no release notes for vX.Y.Z yet", or when asked to write or fix the release notes of a version.
---

# release-notes

The notes people read in the app (Settings > About, and the updates page before they install) are written by you, the agent cutting the release: no API, no key. `scripts/release.sh` refuses to bump a version until they exist; it prints the commits since the last tag.

## Steps

1. Read the commits since the last tag, subjects and bodies: `git log --no-merges --format='%s%n%n%b%n-----' $(git describe --tags --abbrev=0 --match 'v[0-9]*')..HEAD`. Open a PR or the code when a subject doesn't say what a person would notice.
2. Add the version to `app/apps/client/src/features/release-notes/written-notes.json` (keep the others):
   ```json
   {
     "0.1.105": {
       "en": { "features": ["…"], "bugFixes": ["…"] },
       "ro": { "features": ["…"], "bugFixes": ["…"] }
     }
   }
   ```
3. `bun app/scripts/generate-changelog.ts` checks the file (it fails on a malformed entry); then commit the JSON on the release branch and run `./scripts/release.sh <patch|x.y.z>` again. It regenerates CHANGELOG.md, whose section the release CI copies into the GitHub release.

## What to write

- The readers are church volunteers at the projection desk, not developers.
- `features`: what is new or works better, one short sentence each, saying what they can now do.
- `bugFixes`: what was wrong and now works, one short sentence each, saying what they will notice.
- Leave out what they never see: tests, CI, builds, refactors, developer tooling, review builds, agents, task IDs (T-123, CH-45), file and function names. Merge commits about the same change into one item. Most important first, at most 12 per list; an empty list when there is nothing.
- Romanian: write it yourself, not a word-for-word translation of the English: natural church wording (cântare, verset, program, ecran, transmisiune), diacritics with the comma below (ș ț, never ş ţ).

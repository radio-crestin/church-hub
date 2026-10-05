---
id: T-078
title: Pre-release build with everything on main
sprint: 2026-10-05
urgent: true
status: doing
owner: release-2
rolled: 0
order: 0
created: 2026-10-05
---
## Goal
User 2026-10-05: «create a pre-release version wth all the things from the main». Cut a new version from current origin/main (includes PRs #111–#117 and the T-075 tooling change) and publish it as a GitHub pre-release (not marked latest, so the auto-updater of normal users doesn't pick it up, unless the release flow says pre-releases are already excluded — check). Release flow: `scripts/release.sh <x.y.z>` with an explicit version = next patch after the latest v* tag (the conf version drifts behind tags). If release.sh has no pre-release option, mark the release as pre-release after CI publishes it (gh release edit --prerelease) and make sure latest.json/updater isn't pointed at it. Wait for the release build on macOS, Windows and Linux to go green (including the /ping smoke test) and put the version, release URL and installer links in the notes.

## Notes
- 2026-10-05: User 2026-10-05: «at the end after everything is fixed and merged make sure to release a pre-release». So: cut the pre-release only after T-080 (issue #118, CI failing) is fixed and merged and CI on main is green. Also push the local T-081 commit 46573d4b (skill) first so it's included. The pre-release build must be green on all 3 OSes before reporting.
- 2026-10-05: 2026-10-05 lead: all prerequisites merged and pushed: PR #119 (T-080, fixes issue #118) merged as 5677a3eb; T-081 skill 46573d4b and T-089 rules bfcd0f79 pushed. Steps now: 1) run the Test workflow on main (workflow_dispatch: `gh workflow run test.yml --ref main`) and watch it until green; red → find the root cause and report to the lead before releasing. 2) When green, close issue #118 with a comment citing that run and PR #119. 3) Cut the pre-release from that main commit as the goal says; release build green on all 3 OSes (incl. /ping smoke test). Notes: version, release URL, installer links, green run links.
- 2026-10-05: User chose option B: first a small PR to build-release.yml so a release already marked pre-release stays pre-release and is never passed `--latest` (updater's releases/latest must keep pointing at v0.1.102). PR checks all green → message the lead, who merges it. Only then tag v0.1.103 as a pre-release from the updated main; afterwards verify releases/latest still serves v0.1.102's latest.json.
- 2026-10-05: 2026-10-05 release-2: Test run on main (5677a3eb) running: https://github.com/radio-crestin/church-hub/actions/runs/37312682437. Option B: PR #120 https://github.com/radio-crestin/church-hub/pull/120 (build-release.yml publish step keeps a draft marked --prerelease out of latest). Pushes touching workflows need SSH (gh token lacks workflow scope). Next version: v0.1.103.

---
id: T-066
title: Only iosifnicolae2 and Bogdan can push to main and trigger releases
sprint: 2026-10-05
urgent: true
status: doing
owner: repo-access
rolled: 0
order: 0
created: 2026-10-05
---
## Goal
User 2026-10-05: "all the existing maintainers should be able to push or trigger releases, actually just iosifnicolae2 and Bogdan" (Bogdan = GitHub user bogdanbaghiu).
Today (T-065): main rule set 24468192 and v* tag rule set 24468202 let repository admins (3 accounts) + deploy keys bypass; Bogdan only has write, so he can't push to main or push v* tags.
Wanted: exactly iosifnicolae2 and bogdanbaghiu can push straight to main and create/move v* tags (= trigger a release); the release deploy key keeps its bypass for the version bump. Rulesets can't bypass single users, so e.g. an org team with just those two as the bypass actor instead of the admin role (or the closest GitHub supports — explain). Any other release trigger (workflow_dispatch, comment commands on release workflows) must also allow only those two. Don't remove anyone's repo access; don't change other org settings. Prove it: both accounts allowed (rule insights / evaluate), others refused. Keep details in .claude/tasks-private/ (security notes stay out of the public repo).

## Notes
- 2026-10-05: repo-access 2026-10-05: rule sets main (24468192) + release tags (24468202) now bypass = org team church-hub-release (+ release deploy key on main); admin role removed. Proved on temp branch/tag rule sets: in team -> push accepted, same admin/owner out of team -> GH013 rejected. Org base permission read -> none (all members are owners, nobody lost access). bogdanbaghiu invited via the team: PENDING, he must accept https://github.com/orgs/radio-crestin/invitation. Details + limits: .claude/tasks-private/T-066-notes.md
branch: fix/release-rerun-guard
pr: #97 https://github.com/radio-crestin/church-hub/pull/97
commits: c011ce13 re-run guard (build-release) · 3bce9bd8 manual v* upload refused (build-desktop)
video: none (CI/settings only, no UI)

## PR
- branch:
- pr:
- video:

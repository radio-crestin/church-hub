---
id: T-116
title: Check whether "BCEV Băicoi" leaked into the fixtures or is only our dev data
kind: task
level: normal
order: -9
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T12:53:58.213Z
---

## Goal
User's words (2026-10-06, looking at the dev app on 3001): "also, i see that bcev baicoi is connected .. was that leaked into the fixtures or it's just our own testing env?".

Find where "BCEV Băicoi" comes from in the dev app (account/organization connection, sync, YouTube, settings…), and check whether it, or any other real church/account data or credentials, is in the shipped fixtures, the repo or the builds. If it leaked, remove it from the fixtures (security findings go to .claude/tasks-private/, not the task file or PR). Answer the user plainly.

## Notes

- 2026-10-06: Answer: the "connected" BCEV Băicoi is the YouTube channel login (plus a Google Drive login) stored only in this PC's dev database (app/data/app.db, gitignored). Not in the fixtures, not anywhere in git history (searched every branch for the channel id, the account email and Google token patterns), so not in any build; review builds and fresh installs start with empty logins. Shipped fixtures hold no credentials: API key fields are null. One related thing that IS shipped: default-song-categories.json has a song category named "BCEV Baicoi" holding 2198 of the 26463 fixture songs (the church's songbook, no account data). Removing or renaming it belongs with T-114/T-113 if the user wants it.
- 2026-10-06: No leak: the BCEV Băicoi YouTube/Google Drive login is only in this PC's gitignored dev DB; not in fixtures, git history or builds. Shipped "BCEV Baicoi" song category kept as is (user's choice).

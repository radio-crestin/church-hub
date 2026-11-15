---
id: T-073
title: Deploy the Request a feature backend (worker, R2, WhatsApp relay)
kind: task
level: normal
order: -2
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-06T21:05:18.844Z
---

## Goal
Follow-up of T-001/T-067 (PR #101 merged): the app's "Request a feature" Send needs the Cloudflare worker deployed with its secrets (Issues-only GITHUB_TOKEN), the R2 bucket church-hub-feature-requests, the 50/IP/day limit store, and the WAHA public path from bringes-infrastructure branch feat/waha-api-public-access. Ask the user before every deploy or infra apply. Done = a request sent from the app creates a GitHub issue with the screenshot and a WhatsApp message.

## Notes

- 2026-10-05: User (2026-10-05), moved to this sprint and started now: «deploy everything to cloudflare workers as i see that the submit is not working.. make sure to test it end to end, also make sure that everything is secure, don't leak anything regarding github and so on as this is a public project, let me review it before pushing to github».
Done means:
- Find the root cause of why Send fails today; deploy the worker (and R2 / WhatsApp relay it needs) to Cloudflare Workers.
- End-to-end test: a real submit from the app reaches the worker and creates the result (GitHub issue / WhatsApp), then clean up any test issue/message.
- Security: the repo is public. No GitHub token, Cloudflare account id, WhatsApp group link, secrets or internal URLs in source, commits, PR text, task notes or logs. Secrets only as Wrangler secrets. Worker validates input, limits size, rate-limits, and never returns upstream error details. Security findings go to .claude/tasks-private/ (gitignored), never task files or PRs.
- Do NOT push to GitHub or open a PR until the user reviews it: commit locally, then report to the lead.
Same owner as the new UI-simplification task (Request a feature, shorter).
- 2026-10-05: Root cause: the live worker was an old version (from July) without the /feature-requests route, so Send got 404. Deployed 2026-10-05 from branch feat/request-a-feature-simpler (approved by the user): created R2 bucket church-hub-feature-requests (private), deployed the worker with the rate limiter. GitHub issue + screenshot work; WhatsApp is skipped until WAHA is configured (see below).
Commits (local, NOT pushed): 98727d7d worker accepts requests without a title (issue named after the first line of the description; old apps' titles still work), 413 for bodies over 8 MB, no mention pings from context fields, 5 new tests (23/23 pass); 2cd52618 deploy.sh uploads .prod.vars as Worker secrets (--secrets-file) instead of plain-text vars, docs updated.
E2E (nothing mocked): app on port 3190 -> local server -> deployed worker -> GitHub: issue created with the derived title, label feature-request, embedded screenshot served by the worker (200, image/jpeg, nosniff), no email in the issue. Then deleted the issue and the R2 object (screenshot now 404). The label feature-request now exists on the repo (created by that request; real requests need it).
Also checked after deploy: health OK, YouTube and Drive OAuth still redirect to Google, invalid bodies get 400 with a short message.
Security notes: private file, see the lead's message (not here).
Left for the user (WhatsApp): 1) push + apply the bringes-infrastructure branch feat/waha-api-public-access (not applied: the public WAHA hostname has no DNS); 2) create the Cloudflare Access service token for it; 3) add WAHA_URL, WAHA_API_KEY, WAHA_CHAT_ID (+ WAHA_ACCESS_CLIENT_ID, WAHA_ACCESS_CLIENT_SECRET, optional WAHA_SESSION) to churchhub-backend/.prod.vars in the main checkout; 4) cd churchhub-backend && npm run deploy:prod. Then a Send also posts to WhatsApp.
- 2026-10-05: Resolved by the user 2026-10-05. The worker is live on Cloudflare (it was an old version without /feature-requests → 404). Secrets are now encrypted Worker secrets. Tested end to end against GitHub. WhatsApp relay skipped by the user for now (4 steps in the note above). Commits are local on feat/request-a-feature-simpler and ship in T-090's PR.

## PR
- branch:
- pr:
- video:

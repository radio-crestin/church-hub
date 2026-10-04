---
id: T-001
title: Request a feature — element-picker screenshot tool → GitHub issue + WhatsApp
sprint: 2026-09-28
urgent: true
status: doing
owner: feature-request
rolled: 0
order: 0
created: 2026-10-04
---
## Goal
Rename "Feedback" to "Request a feature". It opens like a screenshot tool: the user picks an HTML element, and the request packs the element's exact path plus a screenshot. The user can draw on the screenshot and add notes. It also asks for an email, saved after the first time it is typed. The request goes to the backend (Cloudflare worker), which creates a public GitHub issue (the UI warns that it will be public; the email is never put in the issue) and sends a WhatsApp message through WAHA (config in /Users/iosif/Documents/Projects/bringes-infrastructure/environments/whatsapp_production) with the title, message, user notes and email. WAHA must be reachable from the worker. When done, the app opens the created issue. No secrets committed (public repo), including WAHA and GitHub OAuth. Work on a feature branch, never push to main: the user reviews the commits.

## Notes
- 2026-10-04: Started in worktree agent-a7afd339125c499ec on branch feat/request-a-feature.
- 2026-10-04: User: anyone could spam the public GitHub issues and WhatsApp through the endpoint → limit to 50 requests per IP. Taken as 50 per IP per day, which needs a counter (KV/Durable Object), since the Workers rate-limit binding only allows 10s/60s windows.
- 2026-10-04: User decision: WAHA reach = public path + Access (waha-api.bringes.io → datacenter-vpn → public Traefik, only /api/sendText, CF Access service token + X-Api-Key). The tunnel was dropped: the cluster has no direct egress (Squid only).
- 2026-10-04: 2026-10-04: The worker, server relay, client tool and e2e spec are committed on feat/request-a-feature (c0d5158d..ce001d0d). 6/6 e2e specs pass on port 3017 (CI mode). Gotchas: in a worktree, Playwright's headless shell 1217 is missing, so I used a scratch config with executablePath set to headless_shell-1243. `bun add` bumps @tauri-apps/api in the lockfile, so I edited the lockfile by hand. The test app runs in Romanian. Next: infra option B (waha-api.bringes.io through public Traefik and Cloudflare Access) in a bringes-infrastructure worktree under the scratchpad.
- 2026-10-04: 2026-10-04: Infra option B is committed in bringes-infrastructure branch feat/waha-api-public-access (e351ab5 whatsapp_waha 0.7.0 extraIngresses; e3250eb waha-api.bringes.io /api/sendText on the public traefik plus a DNS record). The worktree is at the scratchpad path bringes-infra-waha. Gotcha: git-crypt blocks `worktree add`, so pass `-c filter.git-crypt.smudge=cat -c filter.git-crypt.clean=cat`, and commit with BRINGES_GITCRYPT_KEY_PATH pointing at the main repo's key. Nothing was pushed or applied. Church-hub branch feat/request-a-feature: c0d5158d..ce001d0d (7 commits).
- 2026-10-04: User: store issue screenshots in Cloudflare R2, not on a GitHub branch, so the worker's token never gets Contents write (can't edit code). Revert fa54e125's approach: R2 bucket + worker GET route serving the image, embedded in the issue. GITHUB_TOKEN back to Issues-only.
- 2026-10-04: 2026-10-04: Screenshots are back in R2 (d4419a28): binding FEATURE_REQUEST_SCREENSHOTS, bucket church-hub-feature-requests, served at GET /feature-requests/screenshots/:uuid.ext. GITHUB_TOKEN is Issues-only and the orphan branch is gone. Only jpeg/png/webp up to 5 MB, checked during validation. Worker tests 14/14 pass, e2e 6/6 pass.

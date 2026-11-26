# Backend endpoint
How the app finds Church Hub's backend (churchhub-backend), and how to move new versions to another one while released versions stay on the legacy Worker.
Open it to switch release builds to the new backend, roll that back, or add a feature that calls the backend.

## One base URL
`getBackendBaseUrl()` (`app/apps/server/src/service/backend/`) is the only place the server reads the backend's address. It is, in order:
1. `CHURCH_HUB_BACKEND_URL`, set on one machine: development, tests, a self-hosted backend.
2. `CHURCH_HUB_BUILD_BACKEND_URL`, baked into release builds by `bun build --env=CHURCH_HUB_BUILD_*` (`scripts/compile.ts`). `build-desktop.yml` sets it from the repository variable `BACKEND_PUBLIC_URL`.
3. The legacy backend, `https://churchub-backend.radiocrestin.ro` (the Cloudflare Worker), when neither is set.

Every caller goes through it:
- Google sign-in: YouTube (`createYouTubeAuthUrl`, `GET /api/livestream/youtube/auth-url`, token refresh in `youtube/client.ts`), Drive backup (`backup/oauth`, `getDriveService.ts`), the cloud owner (`ownerSignIn.ts`, through the sync service URL).
- Cloud sync (`getSyncServiceUrl`, `CHURCH_HUB_SYNC_URL` narrows it for tests).
- The signaling relay for remote access and live translation (`getSignalingBaseUrl`, `CHURCH_HUB_SIGNALING_URL` narrows it for tests), the pairing code's `&relay=` and the listener link.
- Feature requests (`forwardFeatureRequest.ts`).
- Church Hub Cloud backup (`backup/cloud`): its sign-in goes to the backend, and it is offered only once that is not the legacy one (`isCloudBackupAvailable`).

The desktop client never names the backend: it asks the server (the YouTube sign-in URL, the listener link). The public web app keeps the legacy backend as the default for join links without `s=`: released versions leave `s` out for it, so it must not change; current versions always write `s`.

## Switching new versions to the new backend
1. Check the new backend is live: its secrets are filled and `https://church-hub-api.radiocrestin.ro/health/ready` answers.
2. Give it the same configuration as the Worker, with its own host: `PUBLIC_BASE_URL=https://church-hub-api.radiocrestin.ro`, `YOUTUBE_REDIRECT_URI`, `DRIVE_REDIRECT_URI`, `OWNER_REDIRECT_URI` on that host, and the Worker's `ALLOWED_ORIGINS`.
3. On the Google OAuth client, add these authorized redirect URIs, keeping the Worker's:
   - `https://church-hub-api.radiocrestin.ro/auth/youtube/callback`
   - `https://church-hub-api.radiocrestin.ro/auth/drive/callback`
   - `https://church-hub-api.radiocrestin.ro/sync/owner/callback`
4. Set the variable: `gh variable set BACKEND_PUBLIC_URL --body https://church-hub-api.radiocrestin.ro`.
5. Cut a release. Its sidecar has the new backend baked in; in the installed app, YouTube sign-in opens on the new host.

To roll back, `gh variable delete BACKEND_PUBLIC_URL` and release again: builds fall back to the legacy backend.

## What stays on the legacy backend
- Every released version, for everything: the Worker gets no breaking changes.
- A church already connected to cloud sync keeps the service it joined (its stored `serviceUrl`), on any version.
- A join link without `s=`.

## Phones and listeners across versions
After the switch, an updated computer opens its rooms on the new relay and also on the legacy one (`getSignalingRelayUrls`), so phones paired and listener links shared before the switch keep reaching it. Its pairing code and listener link name the new relay. A backend set on the machine (`CHURCH_HUB_BACKEND_URL` or `CHURCH_HUB_SIGNALING_URL`) is the only relay used.

Every phone app with remote access (v0.1.102 on) reads the relay from the pairing code, and a listener page talks to the host it was opened from, so both follow whichever relay the computer named.

| Computer | Phone or listener | Meets on | Works |
|---|---|---|---|
| released | released | legacy relay | yes |
| released | updated | legacy relay (from the computer's code or link) | yes |
| updated, before the switch | either | legacy relay | yes |
| updated, after the switch | paired or linked before the switch | legacy relay (the computer announces there too) | yes |
| updated, after the switch | paired or linked after the switch, released or updated | new relay (from the code or link) | yes |

Remote access and live translation both open their rooms through `startSignalingRelay`, so both are announced on the two relays. The rooms are hosted rooms (`h1` ids, #283): the computer proves itself with its host key on each relay, and the Worker accepts them as well as released versions' rooms. Phone pairings and listener links made by a version before #283 already stopped when the computer updated to it (it serves only its hosted rooms), whichever relay they name.

Delete the legacy announcing (`getSignalingRelayUrls`) once no paired phone or shared link names the legacy relay any more.

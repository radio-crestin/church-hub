# Auto-update

Church Hub updates itself through the Tauri updater plugin. The operator
sees "Version X is available", presses Download, then Install and restart.
Everything after that is automatic: the app closes, the new version is
installed, the app opens again. Songs, schedules, settings and logs live in
the per-user data directory (`%APPDATA%\church-hub` on Windows,
`~/Library/Application Support/church-hub` on macOS) and are never touched.

## What happens, step by step

1. **Check** — every hour, and on "Check now", the webview calls the plugin's
   `check()`. The plugin fetches
   `https://github.com/radio-crestin/church-hub/releases/latest/download/latest.json`
   and compares the manifest's version with the running one as semver, in
   Rust. `releases/latest` only resolves to a published, non-prerelease
   release, so drafts are never offered.
2. **Download** — the plugin streams the platform artifact into memory and
   verifies its minisign signature against the public key compiled into the
   app (`plugins.updater.pubkey` in `app/tauri/tauri.conf.json`). A file that
   does not verify is never installed. The client retries network failures
   three times.
3. **Prepare** — the client invokes `prepare_update_install` (Rust,
   `app/tauri/src/updater.rs`). It writes `app-update-pending.json` to the data
   directory, stops the sidecar and waits for port 3000 to be released. On
   Windows this matters: the plugin exits through `std::process::exit`, which
   skips the normal exit handling, and a sidecar still running would keep
   `church-hub-sidecar.exe` locked while the installer replaces it.
4. **Install**
   - *Windows*: the plugin runs the NSIS installer with `/P /R /UPDATE` and
     exits. `/P` skips every wizard page and leaves only the progress bar,
     which closes itself. `/UPDATE` is Tauri's in-place upgrade mode: no
     uninstall of the previous version, shortcuts and autostart kept, WebView2
     not reinstalled. `/R` relaunches the app when the install succeeds. The
     installer is built per-user (`%LOCALAPPDATA%\church-hub`), so no UAC
     prompt appears. `app/tauri/windows/hooks.nsh` adds a pre-install step
     that stops a lingering `church-hub-sidecar.exe`, as a second line of
     defence.
   - *macOS*: the plugin extracts the `.app.tar.gz` into a temporary
     directory, moves the current bundle aside and the new one into place
     (two renames on the same volume), then the client calls `relaunch()`.
5. **Verify** — on the next launch the Rust side reads the marker. If the
   running version is the one that was installed, a toast says "Updated to
   vX". If it is not, the update did not land and the operator is told so,
   with a pointer to the logs. Either way the marker is removed.

## Release workflow

`.github/workflows/build-release.yml`:

- `bundle.createUpdaterArtifacts: true` makes the bundler produce the
  updater artifacts and sign them: `church-hub.app.tar.gz` + `.sig` on macOS,
  `church-hub_<version>_x64-setup.exe` + `.sig` on Windows. `tauri-action`
  uploads them to the draft release along with the DMG and the setup exe.
- The `create-release` job refuses to run when `TAURI_SIGNING_PRIVATE_KEY`
  is not set, and each build job fails if no `.sig` was produced. An unsigned
  release would be one no installed copy could update to.
- The `updater-manifest` job runs once all three builds are up. It reads the
  `.sig` files from the release and writes `latest.json` with the download
  URLs and signatures for `darwin-aarch64`, `darwin-x86_64` and
  `windows-x86_64`, plus the release body as `notes`.
- Publishing the draft is still a manual step. Until then
  `releases/latest/download/latest.json` points at the previous release and
  nobody is offered the new one.

## The signing key

The updater trusts exactly one minisign key pair. The public half is in
`tauri.conf.json`; the private half must be in the repository secrets:

| Secret | Content |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | the private key file, as text |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | its password |

Losing the private key means no installed copy can ever accept another
update, because the public key is compiled into every build. Keep it backed
up outside the repository. Rotating it requires shipping one release signed
with the old key whose `tauri.conf.json` carries the new public key.

To generate a new pair:

```bash
cd app
bunx tauri signer generate -w ~/.tauri/church-hub-updater.key
```

## Trying it locally

The plugin can only replace a packaged app, so the flow is exercised on a
release build, never with `tauri dev`. Point a development build at a test
manifest by editing `plugins.updater.endpoints`, or use the unit tests:

- `app/tauri/src/updater.rs` — marker handling (`cargo test updater`)
- `app/apps/client/src/features/app-update/services/__tests__/updateStore.test.ts`
  — download retry, install ordering, failure recovery
- `app/apps/client/e2e/app-update.spec.ts` — the updates page in a browser

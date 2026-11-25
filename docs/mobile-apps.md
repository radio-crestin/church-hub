# The phone apps (Android, iOS)

The phone app is the Church Hub client in Tauri's mobile shell. It has no server of its own: it connects to the Church Hub computer, on the church Wi-Fi or, with remote access on, from anywhere over WebRTC.

## Connecting a phone

1. On the computer, open **Settings > Telefoane** (Phones) and pick the account the phone signs in with.
2. Scan the QR code:
   - with the phone's camera: the browser opens Church Hub, signed in to that account (same Wi-Fi only);
   - with **Scanează codul QR** in the app: the app connects at once.

The QR code holds the account's sign-in link, `http://<computer>:<port>/api/auth/user/<token>`. With **Acces de oriunde** (remote access) on, the link also ends in `#remote=<room>&relay=<relay>`. The browser never sends that part to the server; only the app reads it.

## Remote access (away from the church Wi-Fi)

When **Acces de oriunde** is on, the computer keeps a room open on the church's signaling relay. The relay is the `/signal` routes of `churchhub-backend`, the Cloudflare Worker that live translation also uses.

At start-up, the app first tries the computer's address. When that doesn't answer and the phone was paired with remote access on, the app does this instead:

1. It leaves a WebRTC offer in the computer's room. The computer polls every 2 s and answers with `werift` (`app/apps/server/src/service/remote-access/`).
2. One data channel then carries all of the app's traffic:
   - every request (`fetch`) and WebSocket to the computer's address;
   - media loaded by URL, which arrives as blob URLs (`useMediaUrl`).
3. On the computer, the tunnel replays that traffic on a loopback listener of its own. The server counts those requests as coming from a device elsewhere, never from the computer itself. The phone signs in with its own account, like any LAN device. It gets no passwordless login, no pairing codes and no localhost-only routes.

Only STUN is used for now (Google's public servers). Two networks that both block direct connections, such as some strict corporate Wi-Fi, would need a TURN server, which isn't set up.

Turning remote access off closes the room and disconnects the phones.

## Building

The phone builds compile the client only (`tauri.android.conf.json`, `tauri.ios.conf.json`). The sidecar, projector windows, screen sharing and audio player are desktop-only (`[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` in `app/tauri/Cargo.toml`). `app/tauri/gen/` is generated and not committed: run `init` first in a fresh checkout, and again (after deleting `gen/android` or `gen/apple`) whenever `@tauri-apps/cli` is upgraded, since its project templates change with it. Both phone configs set the desktop `bundle.resources` to `null`, so the client dist, MIDI, sample music and backgrounds stay out of the phone bundles. `tauri-plugin-keep-screen-on` is vendored in `app/tauri-plugins/` because the published 0.1.4 sets `targetSdk` in its Android library, which the Android Gradle Plugin 9 template rejects.

### Android (Windows, Linux or macOS)

Tibi PC already has these. Elsewhere, install:
- JDK 17;
- the Android SDK command-line tools, then `sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" "ndk;27.2.12479018"`;
- `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`.

Set the environment, then build from `app/`:

```sh
export ANDROID_HOME=<sdk> NDK_HOME=<sdk>/ndk/27.2.12479018 JAVA_HOME=<jdk-17>
bun run android:init                                  # once: generates tauri/gen/android
bunx tauri android build --apk --target aarch64 --ci  # release, unsigned
bunx tauri android build --apk --debug --target aarch64 --ci  # debug, installable as is
```

The release APK is signed with the church's key:
```sh
zipalign -f -p 4 app-universal-release-unsigned.apk aligned.apk
apksigner sign --ks church-hub-release.jks --ks-key-alias church-hub --out church-hub-android.apk aligned.apk
```

Every update must be signed with the **same key**, or Android refuses to install it over the old app. Where the key is:
- Tibi PC: `%LOCALAPPDATA%\church-hub-signing\` (`church-hub-release.jks` and its password).
- Superfactory secrets: `ANDROID_KEYSTORE_FILE_SECRET` (the keystore, base64) and `ANDROID_KEYSTORE_PASSWORD`.
- For CI: the same two as GitHub repository secrets.

To install on a phone: open the APK on the phone and allow installing from that source, or run `adb install church-hub-android.apk`.

### iOS (macOS with Xcode)

```sh
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
bun run ios:init                                         # once: generates tauri/gen/apple
bunx tauri ios build --debug --target aarch64-sim --ci   # simulator, no signing (Xcode 27 needs CLI ≥ 2.12.6)
```

Installing on an iPhone needs an Apple Developer account (TestFlight or the App Store). Publishing to the stores comes later.

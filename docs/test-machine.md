# The build and test machine: Tibi PC

Tibi PC is where Church Hub is built and tested, on a copy of the church's real data. Adunare PC is the church's live machine: read from it, change nothing there.

| | Tibi PC | Adunare PC |
|---|---|---|
| Superfactory machine | `tibi-pc` (desktop-s0jh1kr-4b66dc) | `Adunare PC` (10-4-101-2-0f7409) |
| Role | build and test; never shut it down unless the user asks | live services: projector, OBS, mixer |
| Address | 10.10.30.242 | 10.4.101.2 (church network) |
| Hardware | Windows 10, Gigabyte B550, NVIDIA GPU | Windows |

Tibi PC already has the Windows toolchain: bun, Rust (`x86_64-pc-windows-msvc`), Visual Studio 2022 Build Tools (MSVC, Windows SDK), WebView2, ffmpeg. It also runs other projects (best-remote-desktop): leave their things alone.

## Where the data is

- `C:\Users\Tibi\church-hub-data\adunare\`: **the copy of Adunare's data**, never edited: `app.db` (a consistent snapshot), `media/`, `song-sources/` and `music/` (the 456 MP3s of the music library).
- `%APPDATA%\church-hub\` (`C:\Users\Tibi\AppData\Roaming\church-hub`): the data of the Church Hub installed on Tibi PC, loaded from that copy.
- `C:\Users\Tibi\church-hub-backups\`: what each load replaced.

Loading the copy into a data folder (`app/scripts/use-adunare-copy.ts`) backs up the folder, copies the data in, points the music library and the local backup folder at Tibi PC, and switches off what reaches the church's live accounts and gear: the YouTube sign-in is removed, the mixer is disabled. The pristine copy keeps them.

## Run Church Hub on the real data

- **The installed app** (port 3000, like at church): build the Windows installer from `main` and install it over the existing one (the data stays):
  ```sh
  cd app
  bunx tauri build --bundles nsis --config '{"bundle":{"createUpdaterArtifacts":false}}'
  tauri/target/release/bundle/nsis/church-hub_<version>_x64-setup.exe /S
  ```
  Without the release signing key, the updater files are left out, as CI does for non-release builds.
- **A task's own server** (its port, never 3000/3001): load the copy into its `app/data` before starting it: `bun app/scripts/use-adunare-copy.ts app/data`.
- **A review build** (`bun app/scripts/review-build.ts <task>`): load the copy into its data folder: `bun app/scripts/use-adunare-copy.ts .review-build/<task>/data` in the main checkout.

Close the Church Hub that uses a folder before loading the copy into it.

## Refresh the copy from Adunare PC

From a Superfactory task whose machines include Adunare PC:

1. Take a consistent snapshot while Church Hub runs, on Adunare PC (`platform_run`, from the task's copy there). SQLite's `VACUUM INTO` only reads the live database: no need to close the app, nothing changes in its folder. The script checks the snapshot's integrity and prints its counts:
   ```sh
   bun app/scripts/snapshot-db.ts "C:/Users/Adunare/church-hub-backups/snapshot_$(date +%Y-%m-%d_%H%M)"
   ```
2. Copy to Tibi PC (`platform_copy`, SHA-256 checked on arrival), into a new folder, then swap it for `C:\Users\Tibi\church-hub-data\adunare\`:
   - the snapshot's `app.db`;
   - `C:\Users\Adunare\AppData\Roaming\church-hub\media` and `...\song-sources`;
   - the music library, `C:\Users\Adunare\Documents\cantari\Midi PDC\midi-mp3-output\midi-mp3-output`, as `music` (only when it changed: 524 MB).
3. Load it where it's needed, as above.

Last refresh: 2026-11-22 22:48 (CH-187): songs 27,320, programs 54 / 554 items, users 5, screens 4, Bible translations 3, music files 456.

## What only Adunare PC can test

- The projector and the stage/livestream screens on their real displays (Tibi PC has its own monitors).
- OBS: Church Hub talks to the OBS on the same machine (127.0.0.1:4455). Tibi PC has no OBS set up like the church's scenes.
- The X32 mixer at 10.4.101.3 (church network; disabled in the copy).
- YouTube streaming on the church's channel (sign-in removed in the copy; sign in to a test channel to test it).
- MIDI devices and anything plugged into that PC.

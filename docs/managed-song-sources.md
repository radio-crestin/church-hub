# Managed song sources
How Church Hub computes its own song sources (today Resurse Creștine) and publishes them to this repository's `song-sources` GitHub release, where the app reads them.
Open it to trigger a run, check what a run published, or add another managed source.

## What runs
- `.github/workflows/resurse-crestine-archive.yml`, daily at 03:17 UTC and on demand:
  1. builds the archive from resursecrestine.ro (`app/apps/server/scripts/build-resurse-crestine-archive.ts`);
  2. reads the release's `resurse-crestine.chsongs.sha256`;
  3. when the new bundle's checksum differs, uploads the three files to the release (`gh release upload --clobber`).
- Permissions: the workflow's default token is `contents: read`; only the `rebuild` job gets `contents: write`, which uploading release assets needs. The checkout keeps no credentials (`persist-credentials: false`). No other secret or variable is used.

## What the release holds
```
resurse-crestine.chsongs          the song bundle (a ZIP: manifest.json plus one OpenSong file per song)
resurse-crestine-opensong.zip     the same bytes, for other programs
resurse-crestine.chsongs.sha256   the bundle's checksum: the `checksum` in its manifest.json
```
The same release holds `bcev-baicoi`, a built-in source read and checked the same way (published once; no workflow updates it), and copies of the `laudele-domnului` and `pe-drumul-credintei` hymnals, which the app reads from cantaricrestine.ro instead.

## How the app reads it
- The source's config (`app/apps/server/src/service/song-sources/built-in/resurse-crestine.json`) has the release file as its `url`.
- To see whether the songs changed, the server reads only the `.sha256` (`readSourceChecksum.ts`).
- To read the songs it downloads the `.chsongs` and refuses it unless every ZIP entry matches its CRC-32 and the manifest's checksum equals the `.sha256` (`downloadSongFile.ts`): a damaged download, an upload caught half-way or a stale copy fails the check (and is tried again at the next one) instead of importing.
- `CHURCH_HUB_SONG_SOURCES_RELEASE_URL` points the built-in sources at another release (a fork's, or the e2e suite's stand-in, `e2e/song-sources-release.api.spec.ts`).

## Trigger a run
The workflow runs from `main`:
```bash
gh workflow run resurse-crestine-archive.yml --repo radio-crestin/church-hub --ref main
gh run watch --repo radio-crestin/church-hub
gh release view song-sources --repo radio-crestin/church-hub   # the assets and when they changed
```
An unchanged run logs the checksum and skips the upload.

## Adding another managed source
1. Write a build script that writes `<id>.chsongs` (with `assembleBundle` and `zipBundleFiles`, as the Resurse Creștine one does) and `<id>.chsongs.sha256` holding the bundle's checksum.
2. Give it a workflow like `resurse-crestine-archive.yml`, with the same permissions, uploading to the `song-sources` release.
3. Add its config in `app/apps/server/src/service/song-sources/built-in/`, with the release file as its `url`, and list it in `builtInSongSources.ts`.

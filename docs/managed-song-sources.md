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

## As a shared library, featured and shipped offline (CH-177)
The sources Church Hub manages are also published in the shared library format (`app/packages/song-formats/src/library`: a manifest and gzipped shards of about 500 songs) under `libraries/<sourceId>/` in the sync bucket, so every app reads them the way it reads a church's shared songs.
- **Publishing**: `bun scripts/publish-library.ts <file.chsongs> <sourceId> [name] [category]` (in `app/apps/server`, with `LIBRARY_PUBLISH_TOKEN` and `CHURCH_HUB_SYNC_URL`). It sends only the shards the bucket lacks, and nothing when the songs are unchanged. The sync service accepts writes to libraries that belong to no church from a signed-in curator or from that token (`LIBRARY_PUBLISH_TOKEN` on the service).
- **The workflow step** (to add to `resurse-crestine-archive.yml` by a person: the agents' GitHub App cannot change workflows), after "Publish to the song-sources release", with a repository secret `LIBRARY_PUBLISH_TOKEN` equal to the service's:
  ```yaml
      - name: Publish as a shared library
        if: steps.build.outputs.checksum != steps.release.outputs.checksum
        working-directory: app/apps/server
        env:
          CHURCH_HUB_SYNC_URL: ${{ vars.BACKEND_PUBLIC_URL }}
          LIBRARY_PUBLISH_TOKEN: ${{ secrets.LIBRARY_PUBLISH_TOKEN }}
        run: bun scripts/publish-library.ts "$RUNNER_TEMP/archive/resurse-crestine.chsongs" resurse-crestine
  ```
- **Featured list**: curators choose, on Settings > Church Hub Library, which published libraries every app offers (`libraries/featured.json`). Apps read it at start and twice a day and keep the last copy next to their database. A source it names replaces the built-in source with the same id (`resurse-crestine` keeps its id, so songs imported from it stay linked); built-in sources it does not name stay.
- **Offline**: the desktop build (`build:apps`) runs `scripts/bundle-song-libraries.ts`, which copies the featured list and each library's manifest and shards into `app/tauri/resources/song-libraries` (a Tauri resource). With no internet, the app takes the list and the libraries' files from that copy (`fetchLink` falls back to it), so their songs can be imported; online, they update from the bucket.

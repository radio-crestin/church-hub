/**
 * The public URL of the bucket holding Church Hub's managed song sources
 * (docs/managed-song-sources.md), or '' when none is set: the sources are
 * then read from the GitHub release. Baked into release builds from
 * CHURCH_HUB_BUILD_SONG_SOURCES_URL (scripts/compile.ts);
 * CHURCH_HUB_SONG_SOURCES_URL overrides it on one machine (a fork's own
 * bucket, the e2e suite's stand-in).
 */
export function getManagedSourcesUrl(): string {
  return (
    process.env.CHURCH_HUB_SONG_SOURCES_URL ||
    process.env.CHURCH_HUB_BUILD_SONG_SOURCES_URL ||
    ''
  ).replace(/\/+$/, '')
}

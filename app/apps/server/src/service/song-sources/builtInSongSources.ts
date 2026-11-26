import bcevBaicoi from './built-in/bcev-baicoi.json'
import laudeleDomnului from './built-in/laudele-domnului.json'
import peDrumulCredintei from './built-in/pe-drumul-credintei.json'
import resurseCrestine from './built-in/resurse-crestine.json'
import type { SongSource, SongSourceConfig } from './types'

const CONFIGS = [
  resurseCrestine,
  bcevBaicoi,
  laudeleDomnului,
  peDrumulCredintei,
] as SongSourceConfig[]

/** Our `song-sources` GitHub release, where the song files are published. */
const SONG_SOURCES_RELEASE =
  'https://github.com/radio-crestin/church-hub/releases/download/song-sources'

/**
 * A file of our release, from CHURCH_HUB_SONG_SOURCES_RELEASE_URL instead
 * when it is set: a fork's own release, or the e2e suite's stand-in.
 */
function fromOurRelease(url: string): string {
  const base = process.env.CHURCH_HUB_SONG_SOURCES_RELEASE_URL
  if (!base || !url.startsWith(`${SONG_SOURCES_RELEASE}/`)) return url
  return `${base.replace(/\/+$/, '')}${url.slice(SONG_SOURCES_RELEASE.length)}`
}

/**
 * The song sources shipped with the app, one config file each in
 * `built-in/`. Adding a source = add its JSON file and list it here.
 * Imported (not read from disk) so the compiled sidecar embeds them.
 */
export const BUILT_IN_SONG_SOURCES: SongSource[] = CONFIGS.map((config) => ({
  ...config,
  url: fromOurRelease(config.url),
  origin: 'built-in',
}))

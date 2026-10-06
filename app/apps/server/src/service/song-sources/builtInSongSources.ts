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

/**
 * The song sources shipped with the app, one config file each in
 * `built-in/`. Adding a source = add its JSON file and list it here.
 * Imported (not read from disk) so the compiled sidecar embeds them.
 */
export const BUILT_IN_SONG_SOURCES: SongSource[] = CONFIGS.map((config) => ({
  ...config,
  origin: 'built-in',
}))

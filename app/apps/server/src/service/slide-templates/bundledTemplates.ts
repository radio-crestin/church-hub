import { getFactoryDesign } from './getFactoryDesign'
import { getPaletteDesign, type Palette } from './getPaletteDesign'
import type { TemplateDesign } from './types'
import type { ScreenType } from '../presentation/types'

export interface BundledTemplate {
  key: string
  /** Stored as is; the client shows it translated (templates.bundled.<key>). */
  name: string
  design: () => TemplateDesign
  /**
   * Among the fitting defaults of the Bible topics: verses read at a glance
   * on it (strong contrast, a calm background).
   */
  forTopics?: true
}

/**
 * The designs that ship with the app, refreshed on every start
 * (seed-bundled-templates): read-only, duplicated to be edited.
 */
/** White words on a darkened photo or video, the accent drawn from it. */
function onMedia(
  file: string,
  opacity: number,
  accent: string,
  fontFamily: Palette['fontFamily'],
): TemplateDesign {
  return getPaletteDesign({
    background: { file, opacity },
    text: '#ffffff',
    accent,
    fontFamily,
    italic: false,
    onMedia: true,
  })
}

export const BUNDLED_TEMPLATES: BundledTemplate[] = [
  {
    key: 'classic',
    name: 'Classic',
    design: () => getFactoryDesign('primary'),
  },
  { key: 'stage', name: 'Stage', design: () => getFactoryDesign('stage') },
  {
    key: 'lower_third',
    name: 'Lower third',
    design: () => getFactoryDesign('livestream'),
  },
  { key: 'kiosk', name: 'Kiosk', design: () => getFactoryDesign('kiosk') },
  // For verse loops before and between services (CH-178).
  {
    key: 'verses_evening',
    forTopics: true,
    name: 'Verses · Evening',
    design: () =>
      getPaletteDesign({
        background: '#141a33',
        text: '#f5f1e8',
        accent: '#e8c27a',
        fontFamily: 'Lora',
        italic: true,
      }),
  },
  {
    key: 'verses_light',
    forTopics: true,
    name: 'Verses · Light',
    design: () =>
      getPaletteDesign({
        background: '#f7efdc',
        text: '#3b2a17',
        accent: '#9a5b1e',
        fontFamily: 'Lora',
        italic: false,
      }),
  },
  {
    key: 'verses_calm',
    forTopics: true,
    name: 'Verses · Calm',
    design: () =>
      getPaletteDesign({
        background: '#123330',
        text: '#e9f4ef',
        accent: '#8fd3bd',
        fontFamily: 'Fira Sans',
        italic: false,
      }),
  },
  // The verses type themselves in, letter by letter (the typewriter text
  // animation), on a sheet of paper or a quiet night.
  {
    key: 'typewriter_paper',
    name: 'Typewriter · Paper',
    design: () =>
      getPaletteDesign({
        background: '#f3ede1',
        text: '#2a2621',
        accent: '#8c5a2b',
        fontFamily: 'Fira Sans',
        italic: false,
        typewriter: true,
      }),
  },
  {
    key: 'typewriter_night',
    name: 'Typewriter · Night',
    design: () =>
      getPaletteDesign({
        background: '#14171c',
        text: '#ece7dc',
        accent: '#d8b874',
        fontFamily: 'Fira Sans',
        italic: false,
        typewriter: true,
      }),
  },
  // Worship themes on a photo or a looping video, like a projection
  // program's: white words, bold with a soft shadow, the accent from the
  // picture (backgrounds: tauri/resources/theme-backgrounds, see CREDITS.md).
  {
    key: 'photo_mountain_sunrise',
    name: 'Mountain sunrise',
    design: () =>
      onMedia('mountain-sunrise.jpg', 0.75, '#E8B04A', 'Montserrat'),
  },
  {
    key: 'photo_misty_forest',
    name: 'Misty forest',
    design: () => onMedia('misty-forest.jpg', 0.7, '#B9D3C4', 'Fira Sans'),
  },
  {
    key: 'photo_golden_wheat',
    forTopics: true,
    name: 'Golden wheat',
    design: () => onMedia('golden-wheat.jpg', 0.6, '#F0A54A', 'Lora'),
  },
  {
    key: 'photo_calm_sea',
    forTopics: true,
    name: 'Calm sea',
    design: () => onMedia('calm-ocean.jpg', 0.6, '#E9B872', 'Montserrat'),
  },
  {
    key: 'photo_starry_night',
    name: 'Starry night',
    design: () => onMedia('starry-night.jpg', 0.85, '#C4B5FD', 'Montserrat'),
  },
  {
    key: 'photo_sea_of_clouds',
    forTopics: true,
    name: 'Sea of clouds',
    design: () => onMedia('sea-of-clouds.jpg', 0.55, '#F2B8A0', 'Lora'),
  },
  {
    key: 'video_ocean_horizon',
    name: 'Ocean horizon · video',
    design: () => onMedia('ocean-horizon.mp4', 0.75, '#A9C8EE', 'Montserrat'),
  },
  {
    key: 'video_golden_clouds',
    name: 'Golden clouds · video',
    design: () => onMedia('golden-clouds.mp4', 0.6, '#F0A848', 'Montserrat'),
  },
  {
    key: 'video_forest_light',
    name: 'Forest light · video',
    design: () =>
      onMedia('forest-light-rays.mp4', 0.55, '#E8D9A8', 'Fira Sans'),
  },
  {
    key: 'video_blue_particles',
    name: 'Blue particles · video',
    design: () => onMedia('blue-particles.mp4', 0.7, '#8FA5FF', 'Montserrat'),
  },
]

/** The bundled design a new screen of this type starts from. */
export const BUNDLED_KEY_FOR_SCREEN: Record<ScreenType, string> = {
  primary: 'classic',
  stage: 'stage',
  livestream: 'lower_third',
  kiosk: 'kiosk',
}

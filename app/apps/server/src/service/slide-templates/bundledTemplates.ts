import { getFactoryDesign } from './getFactoryDesign'
import { getVerseDesign } from './getVerseDesign'
import type { TemplateDesign } from './types'
import type { ScreenType } from '../presentation/types'

export interface BundledTemplate {
  key: string
  /** Stored as is; the client shows it translated (templates.bundled.<key>). */
  name: string
  design: () => TemplateDesign
}

/**
 * The designs that ship with the app, refreshed on every start
 * (seed-bundled-templates): read-only, duplicated to be edited.
 */
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
    name: 'Verses · Evening',
    design: () =>
      getVerseDesign({
        background: '#141a33',
        text: '#f5f1e8',
        accent: '#e8c27a',
        fontFamily: 'Lora',
        italic: true,
      }),
  },
  {
    key: 'verses_light',
    name: 'Verses · Light',
    design: () =>
      getVerseDesign({
        background: '#f7efdc',
        text: '#3b2a17',
        accent: '#9a5b1e',
        fontFamily: 'Lora',
        italic: false,
      }),
  },
  {
    key: 'verses_calm',
    name: 'Verses · Calm',
    design: () =>
      getVerseDesign({
        background: '#123330',
        text: '#e9f4ef',
        accent: '#8fd3bd',
        fontFamily: 'Fira Sans',
        italic: false,
      }),
  },
]

/** The bundled design a new screen of this type starts from. */
export const BUNDLED_KEY_FOR_SCREEN: Record<ScreenType, string> = {
  primary: 'classic',
  stage: 'stage',
  livestream: 'lower_third',
  kiosk: 'kiosk',
}

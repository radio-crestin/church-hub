import { getFactoryDesign } from './getFactoryDesign'
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
]

/** The bundled design a new screen of this type starts from. */
export const BUNDLED_KEY_FOR_SCREEN: Record<ScreenType, string> = {
  primary: 'classic',
  stage: 'stage',
  livestream: 'lower_third',
  kiosk: 'kiosk',
}

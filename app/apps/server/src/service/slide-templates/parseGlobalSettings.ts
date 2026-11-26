import { parseTemplateJson } from './parseTemplateJson'
import { getDefaultGlobalSettings } from '../presentation/default-design/getDefaultGlobalSettings'
import type { ScreenGlobalSettings } from '../presentation/types'

/** The clock and fallback background over their defaults. */
export function parseGlobalSettings(json: string): ScreenGlobalSettings {
  return {
    ...getDefaultGlobalSettings(),
    ...(parseTemplateJson(
      json,
      'global_settings',
    ) as Partial<ScreenGlobalSettings>),
  }
}

import type { TFunction } from 'i18next'

import type { SlideTemplate } from '../types'

/**
 * A bundled template's name in the app's language, a presentation's own
 * theme as such, the church's own as named.
 */
export function templateDisplayName(
  template: Pick<SlideTemplate, 'name' | 'bundledKey'> &
    Partial<Pick<SlideTemplate, 'scheduleId'>>,
  t: TFunction,
): string {
  if (template.scheduleId != null) {
    return t('presentation:templates.presentation.own')
  }
  return template.bundledKey
    ? t(`presentation:templates.bundled.${template.bundledKey}`, {
        defaultValue: template.name,
      })
    : template.name
}

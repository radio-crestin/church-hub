import type { TFunction } from 'i18next'

import type { SlideTemplate } from '../types'

/** A bundled template's name in the app's language; the church's own as named. */
export function templateDisplayName(
  template: Pick<SlideTemplate, 'name' | 'bundledKey'>,
  t: TFunction,
): string {
  return template.bundledKey
    ? t(`presentation:templates.bundled.${template.bundledKey}`, {
        defaultValue: template.name,
      })
    : template.name
}

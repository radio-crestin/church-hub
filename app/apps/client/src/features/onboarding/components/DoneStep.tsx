import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BUILTIN_ITEMS } from '~/features/sidebar-config/constants'
import type { BuiltInMenuItemId } from '~/features/sidebar-config/types'
import { ONBOARDING_FEATURES } from '../constants'

interface DoneStepProps {
  selected: Set<BuiltInMenuItemId>
}

/** Last step: what the side menu will hold. */
export function DoneStep({ selected }: DoneStepProps) {
  const { t } = useTranslation(['onboarding', 'sidebar'])

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
          <CheckCircle2 strokeWidth={1.5} className="h-6 w-6 text-ok" />
          {t('done.title')}
        </h1>
        <p className="text-sm text-fg-label">{t('done.description')}</p>
      </div>
      <ul className="flex flex-wrap gap-2" data-testid="onboarding-summary">
        {ONBOARDING_FEATURES.filter((id) => selected.has(id)).map((id) => {
          const { icon: Icon, labelKey } = BUILTIN_ITEMS[id]
          return (
            <li
              key={id}
              className="flex items-center gap-1.5 rounded-lg bg-field px-2.5 py-1 text-sm text-fg-body"
            >
              <Icon strokeWidth={1.5} className="h-4 w-4 text-fg-label" />
              {t(labelKey)}
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-fg-hint">{t('done.later')}</p>
    </div>
  )
}

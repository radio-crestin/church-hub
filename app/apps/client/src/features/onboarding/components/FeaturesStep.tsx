import { useTranslation } from 'react-i18next'

import { BUILTIN_ITEMS } from '~/features/sidebar-config/constants'
import type { BuiltInMenuItemId } from '~/features/sidebar-config/types'
import { ONBOARDING_FEATURES } from '../constants'

interface FeaturesStepProps {
  selected: Set<BuiltInMenuItemId>
  onToggle: (id: BuiltInMenuItemId) => void
}

/** Second step: the pages to keep in the side menu. */
export function FeaturesStep({ selected, onToggle }: FeaturesStepProps) {
  const { t } = useTranslation(['onboarding', 'sidebar'])

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-fg">{t('features.title')}</h1>
        <p className="text-fg-label">{t('features.description')}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ONBOARDING_FEATURES.map((id) => {
          const { icon: Icon, labelKey } = BUILTIN_ITEMS[id]
          return (
            <label
              key={id}
              data-testid={`onboarding-feature-${id}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg bg-field p-3 transition-colors hover:bg-hover has-[:checked]:bg-selected"
            >
              <input
                type="checkbox"
                checked={selected.has(id)}
                onChange={() => onToggle(id)}
                className="mt-1 h-4 w-4 rounded border-line accent-primary text-primary focus:ring-focus"
              />
              <Icon
                strokeWidth={1.5}
                className="mt-0.5 h-4 w-4 shrink-0 text-fg-label"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">
                  {t(labelKey)}
                </span>
                <span className="block text-xs text-fg-hint">
                  {t(`features.items.${id}`)}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      <p className="text-sm text-fg-hint">
        {t('features.selected', {
          count: selected.size,
          total: ONBOARDING_FEATURES.length,
        })}
      </p>
    </div>
  )
}

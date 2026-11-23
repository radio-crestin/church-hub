import { useTranslation } from 'react-i18next'

import {
  BUILTIN_ITEMS,
  DEFAULT_ICON_COLORS,
  ICON_COLOR_CLASSES,
} from '~/features/sidebar-config/constants'
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('features.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('features.description')}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ONBOARDING_FEATURES.map((id) => {
          const { icon: Icon, labelKey } = BUILTIN_ITEMS[id]
          return (
            <label
              key={id}
              data-testid={`onboarding-feature-${id}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/60 dark:border-gray-700 dark:hover:bg-gray-800 dark:has-[:checked]:border-indigo-500 dark:has-[:checked]:bg-indigo-950/50"
            >
              <input
                type="checkbox"
                checked={selected.has(id)}
                onChange={() => onToggle(id)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <Icon
                className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_COLOR_CLASSES[DEFAULT_ICON_COLORS[id]].text}`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  {t(labelKey)}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {t(`features.items.${id}`)}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('features.selected', {
          count: selected.size,
          total: ONBOARDING_FEATURES.length,
        })}
      </p>
    </div>
  )
}

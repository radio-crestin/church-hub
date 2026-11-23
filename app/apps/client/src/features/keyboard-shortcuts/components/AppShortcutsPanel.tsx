import { useTranslation } from 'react-i18next'

import { PAGES_WITH_SLIDE_KEYS } from '~/features/sidebar-config/constants'
import { GlobalShortcutsSettings } from './GlobalShortcutsSettings'
import { PageShortcutsSettings } from './PageShortcutsSettings'
import {
  LIVESTREAM_SHORTCUT_ACTIONS,
  PRESENTATION_SHORTCUT_ACTIONS,
} from '../constants/shortcutActions'
import { useShortcutPages } from '../hooks/useShortcutPages'

const cardClass =
  'rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900'

/**
 * The consolidated Shortcuts settings page: every configurable keyboard/MIDI
 * shortcut — Presentation, Livestream, then every sidebar page: Songs and
 * Bible (which have their own presentation keys) each in a card, the other
 * pages together.
 */
export function AppShortcutsPanel() {
  const { t } = useTranslation('settings')
  const pages = useShortcutPages()
  const hasSlideKeys = (builtinId?: string) =>
    PAGES_WITH_SLIDE_KEYS.some((id) => id === builtinId)
  const slideKeyPages = pages.filter((page) => hasSlideKeys(page.builtinId))
  const otherPages = pages.filter((page) => !hasSlideKeys(page.builtinId))

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('sections.shortcuts.groups.presentation')}
        </h3>
        <p className="mb-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('sections.shortcuts.groups.presentationDescription')}
        </p>
        <GlobalShortcutsSettings actions={PRESENTATION_SHORTCUT_ACTIONS} />
      </section>

      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('sections.shortcuts.groups.livestream')}
        </h3>
        <p className="mb-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('sections.shortcuts.groups.livestreamDescription')}
        </p>
        <GlobalShortcutsSettings actions={LIVESTREAM_SHORTCUT_ACTIONS} />
      </section>

      {slideKeyPages.map((page) => (
        <section key={page.itemId} className={cardClass}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {page.label}
          </h3>
          <p className="mb-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('sections.shortcuts.groups.pagesDescription')}
          </p>
          <PageShortcutsSettings page={page} />
        </section>
      ))}

      {otherPages.length > 0 && (
        <section className={cardClass} data-testid="other-pages-shortcuts">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('sections.shortcuts.groups.otherPages')}
          </h3>
          <p className="mb-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('sections.shortcuts.groups.otherPagesDescription')}
          </p>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {otherPages.map((page) => (
              <div key={page.itemId} className="space-y-3 py-4 first:pt-0">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {page.label}
                </h4>
                <PageShortcutsSettings page={page} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

import { useTranslation } from 'react-i18next'

import type { BuiltInMenuItemId } from '~/features/sidebar-config/types'
import { GlobalShortcutsSettings } from './GlobalShortcutsSettings'
import { PageShortcutsSettings } from './PageShortcutsSettings'
import {
  LIVESTREAM_SHORTCUT_ACTIONS,
  PRESENTATION_SHORTCUT_ACTIONS,
} from '../constants/shortcutActions'

const cardClass =
  'rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900'

// Pages that expose switch-to-page + focus-search shortcuts.
const PAGE_SHORTCUTS: { pageId: BuiltInMenuItemId; nameKey: string }[] = [
  { pageId: 'songs', nameKey: 'sidebar:navigation.songs' },
  { pageId: 'bible', nameKey: 'sidebar:navigation.bible' },
]

/**
 * The consolidated Shortcuts settings page: every configurable keyboard/MIDI
 * shortcut, grouped by Presentation, Livestream, and per-page navigation.
 */
export function AppShortcutsPanel() {
  const { t } = useTranslation(['settings', 'sidebar'])

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

      {PAGE_SHORTCUTS.map(({ pageId, nameKey }) => (
        <section key={pageId} className={cardClass}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t(nameKey)}
          </h3>
          <p className="mb-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('sections.shortcuts.groups.pagesDescription')}
          </p>
          <PageShortcutsSettings
            pageId={pageId}
            showHeading={false}
            includeShowSlide={false}
          />
        </section>
      ))}
    </div>
  )
}

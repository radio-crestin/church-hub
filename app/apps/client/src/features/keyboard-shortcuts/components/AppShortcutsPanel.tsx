import { useTranslation } from 'react-i18next'

import { PAGES_WITH_SLIDE_KEYS } from '~/features/sidebar-config/constants'
import { GlobalShortcutsSettings } from './GlobalShortcutsSettings'
import { PageShortcutsSettings } from './PageShortcutsSettings'
import {
  LIVESTREAM_SHORTCUT_ACTIONS,
  PRESENTATION_SHORTCUT_ACTIONS,
} from '../constants/shortcutActions'
import { useShortcutPages } from '../hooks/useShortcutPages'

const cardClass = 'rounded-xl border border-line bg-panel p-4 sm:p-6'

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
        <h3 className="text-base font-semibold text-fg">
          {t('sections.shortcuts.groups.presentation')}
        </h3>
        <p className="mb-4 mt-1 text-[13px] text-fg-label">
          {t('sections.shortcuts.groups.presentationDescription')}
        </p>
        <GlobalShortcutsSettings actions={PRESENTATION_SHORTCUT_ACTIONS} />
      </section>

      <section className={cardClass}>
        <h3 className="text-base font-semibold text-fg">
          {t('sections.shortcuts.groups.livestream')}
        </h3>
        <p className="mb-4 mt-1 text-[13px] text-fg-label">
          {t('sections.shortcuts.groups.livestreamDescription')}
        </p>
        <GlobalShortcutsSettings actions={LIVESTREAM_SHORTCUT_ACTIONS} />
      </section>

      {slideKeyPages.map((page) => (
        <section key={page.itemId} className={cardClass}>
          <h3 className="text-base font-semibold text-fg">{page.label}</h3>
          <p className="mb-4 mt-1 text-[13px] text-fg-label">
            {t('sections.shortcuts.groups.pagesDescription')}
          </p>
          <PageShortcutsSettings page={page} />
        </section>
      ))}

      {otherPages.length > 0 && (
        <section className={cardClass} data-testid="other-pages-shortcuts">
          <h3 className="text-base font-semibold text-fg">
            {t('sections.shortcuts.groups.otherPages')}
          </h3>
          <p className="mb-4 mt-1 text-[13px] text-fg-label">
            {t('sections.shortcuts.groups.otherPagesDescription')}
          </p>
          <div className="divide-y divide-line">
            {otherPages.map((page) => (
              <div key={page.itemId} className="space-y-3 py-4 first:pt-0">
                <h4 className="text-[13px] font-semibold text-fg">
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

import { Keyboard } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getDefaultSidebarItemSettings } from '~/features/sidebar-config/constants'
import { useSidebarConfig } from '~/features/sidebar-config/hooks/useSidebarConfig'
import {
  type BuiltInMenuItem,
  type BuiltInMenuItemId,
  PAGE_SHORTCUT_ACTIONS,
  type PageShortcutAction,
  type SidebarItemSettings,
} from '~/features/sidebar-config/types'
import { ShortcutListSection } from './ShortcutListSection'
import { useAppShortcuts } from '../hooks'
import type { GlobalShortcutActionId } from '../types'
import { VALID_ACTION_IDS } from '../utils'

interface PageShortcutsSettingsProps {
  /** The built-in page ID (e.g. 'songs', 'bible') */
  pageId: BuiltInMenuItemId
  /** Render the internal "Keyboard Shortcuts" heading (default true). */
  showHeading?: boolean
}

type PageShortcutLists = Record<PageShortcutAction, string[]>

/** The shortcut-bearing part of a page's settings, comparable as a string. */
function snapshotOf(settings: SidebarItemSettings): string {
  return JSON.stringify({
    shortcuts: settings.shortcuts,
    focusSearchShortcuts: settings.focusSearchShortcuts ?? [],
    pageShortcuts: {
      showSlide: settings.pageShortcuts?.showSlide ?? [],
      nextSlide: settings.pageShortcuts?.nextSlide ?? [],
      prevSlide: settings.pageShortcuts?.prevSlide ?? [],
    },
  })
}

const emptyPageLists = (): PageShortcutLists => ({
  showSlide: [],
  nextSlide: [],
  prevSlide: [],
})

/**
 * Shortcut settings for one page: switch to it, focus its search, and its own
 * presentation keys (show the selected slide/verse, next, previous) — which
 * work only while that page is open, so two pages may bind the same key.
 * Hosted in the consolidated Shortcuts settings page.
 */
export function PageShortcutsSettings({
  pageId,
  showHeading = true,
}: PageShortcutsSettingsProps) {
  const { t } = useTranslation('settings')
  const { config, updateConfig } = useSidebarConfig()
  const { shortcuts: globalShortcuts } = useAppShortcuts()

  const [switchShortcuts, setSwitchShortcuts] = useState<string[]>([])
  const [focusSearchShortcuts, setFocusSearchShortcuts] = useState<string[]>([])
  const [pageLists, setPageLists] = useState<PageShortcutLists>(emptyPageLists)

  // Find the sidebar item for this page
  const sidebarItem = useMemo(() => {
    if (!config) return null
    return config.items.find(
      (item) =>
        item.type === 'builtin' &&
        (item as BuiltInMenuItem).builtinId === pageId,
    )
  }, [config, pageId])

  // What this component last wrote. Its own save comes straight back through
  // the config — without empty rows, which are only ever local — and must not
  // wipe the row the operator is about to record into.
  const lastSavedRef = useRef<string | null>(null)

  // Load values from config (initially, and whenever it changes elsewhere)
  useEffect(() => {
    if (!sidebarItem) return
    const settings =
      sidebarItem.settings ?? getDefaultSidebarItemSettings(pageId)
    if (lastSavedRef.current === snapshotOf(settings)) return

    setSwitchShortcuts([...settings.shortcuts])
    // Migrate legacy: if focusSearchOnNavigate was true and no focusSearchShortcuts,
    // copy shortcuts to focusSearchShortcuts
    if (
      settings.focusSearchOnNavigate &&
      !settings.focusSearchShortcuts?.length &&
      settings.shortcuts.length > 0
    ) {
      setFocusSearchShortcuts([...settings.shortcuts])
    } else {
      setFocusSearchShortcuts([...(settings.focusSearchShortcuts ?? [])])
    }
    const lists = emptyPageLists()
    for (const action of PAGE_SHORTCUT_ACTIONS) {
      lists[action] = [...(settings.pageShortcuts?.[action] ?? [])]
    }
    setPageLists(lists)
  }, [sidebarItem, pageId])

  const clean = (list: string[]) => list.filter((s) => s.trim())

  // Persist everything this page owns in one go.
  const save = useCallback(
    (
      nextSwitch: string[],
      nextFocusSearch: string[],
      nextPageLists: PageShortcutLists,
    ) => {
      if (!config || !sidebarItem) return

      const settings: SidebarItemSettings = {
        ...(sidebarItem.settings ?? getDefaultSidebarItemSettings(pageId)),
        shortcuts: clean(nextSwitch),
        focusSearchOnNavigate: false,
        focusSearchShortcuts: clean(nextFocusSearch),
        pageShortcuts: {
          showSlide: clean(nextPageLists.showSlide),
          nextSlide: clean(nextPageLists.nextSlide),
          prevSlide: clean(nextPageLists.prevSlide),
        },
      }
      lastSavedRef.current = snapshotOf(settings)

      const updatedItems = config.items.map((item) =>
        item.id === sidebarItem.id ? { ...item, settings } : item,
      )

      updateConfig.mutate({ ...config, items: updatedItems })
    },
    [config, sidebarItem, pageId, updateConfig],
  )

  const handleSwitchChange = useCallback(
    (next: string[]) => {
      setSwitchShortcuts(next)
      save(next, focusSearchShortcuts, pageLists)
    },
    [save, focusSearchShortcuts, pageLists],
  )

  const handleFocusSearchChange = useCallback(
    (next: string[]) => {
      setFocusSearchShortcuts(next)
      save(switchShortcuts, next, pageLists)
    },
    [save, switchShortcuts, pageLists],
  )

  const handlePageListChange = useCallback(
    (action: PageShortcutAction, next: string[]) => {
      const nextLists = { ...pageLists, [action]: next }
      setPageLists(nextLists)
      save(switchShortcuts, focusSearchShortcuts, nextLists)
    },
    [save, switchShortcuts, focusSearchShortcuts, pageLists],
  )

  /**
   * A key may not be bound twice on this page, nor clash with a global
   * action (which fires everywhere and would win). It MAY be the same key
   * another page uses for its own actions — which page is open decides.
   * Switching to the page and focusing its search are allowed to share a key.
   */
  const getShortcutError = useCallback(
    (
      shortcut: string,
      index: number,
      sourceList: string[],
      sourceName: 'switch' | 'focusSearch' | PageShortcutAction,
    ): string | undefined => {
      if (!shortcut) return undefined

      const duplicateIndex = sourceList.findIndex(
        (s, i) => i !== index && s === shortcut,
      )
      if (duplicateIndex !== -1) {
        return t('sections.sidebarItem.shortcuts.duplicateError')
      }

      const otherLists: Array<
        ['switch' | 'focusSearch' | PageShortcutAction, string[]]
      > = [
        ['switch', switchShortcuts],
        ['focusSearch', focusSearchShortcuts],
        ...PAGE_SHORTCUT_ACTIONS.map(
          (action) =>
            [action, pageLists[action]] as [PageShortcutAction, string[]],
        ),
      ]
      const navigation = new Set(['switch', 'focusSearch'])
      for (const [name, list] of otherLists) {
        if (name === sourceName) continue
        if (navigation.has(name) && navigation.has(sourceName)) continue
        if (list.includes(shortcut)) {
          return t('sections.sidebarItem.shortcuts.duplicateError')
        }
      }

      for (const [actionId, actionConfig] of Object.entries(
        globalShortcuts.actions,
      )) {
        if (!VALID_ACTION_IDS.includes(actionId as GlobalShortcutActionId))
          continue
        if (actionConfig.shortcuts.includes(shortcut)) {
          return t('sections.sidebarItem.shortcuts.conflictGlobal', {
            action: t(`sections.shortcuts.actions.${actionId}.label`),
          })
        }
      }

      return undefined
    },
    [switchShortcuts, focusSearchShortcuts, pageLists, globalShortcuts, t],
  )

  const pageLabel = (
    action: PageShortcutAction,
    field: 'title' | 'description',
  ) =>
    t(`sections.sidebarItem.shortcuts.page.${pageId}.${action}.${field}`, {
      defaultValue: t(
        `sections.sidebarItem.shortcuts.page.default.${action}.${field}`,
      ),
    })

  return (
    <div className="space-y-4">
      {showHeading && (
        <div className="mb-2 flex items-center gap-2">
          <Keyboard className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('sections.sidebarItem.shortcuts.title')}
          </h3>
        </div>
      )}

      <ShortcutListSection
        title={t('sections.sidebarItem.shortcuts.switchTitle')}
        description={t('sections.sidebarItem.shortcuts.switchDescription')}
        shortcuts={switchShortcuts}
        onChange={handleSwitchChange}
        getError={(s, i, list) => getShortcutError(s, i, list, 'switch')}
        testId={`page-shortcuts-${pageId}-switch`}
      />

      <div className="border-gray-200 border-t pt-2 dark:border-gray-700">
        <ShortcutListSection
          title={t('sections.sidebarItem.shortcuts.focusSearchTitle')}
          description={t(
            'sections.sidebarItem.shortcuts.focusSearchDescription',
          )}
          shortcuts={focusSearchShortcuts}
          onChange={handleFocusSearchChange}
          getError={(s, i, list) => getShortcutError(s, i, list, 'focusSearch')}
          testId={`page-shortcuts-${pageId}-focus-search`}
        />
      </div>

      <p className="text-gray-400 text-xs italic dark:text-gray-500">
        {t('sections.sidebarItem.shortcuts.sameShortcutHint')}
      </p>

      {/* Presentation keys that only work while this page is open */}
      <div className="space-y-4 border-gray-200 border-t pt-3 dark:border-gray-700">
        <div>
          <h4 className="font-semibold text-gray-900 text-sm dark:text-white">
            {t('sections.sidebarItem.shortcuts.page.title')}
          </h4>
          <p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">
            {t('sections.sidebarItem.shortcuts.page.description')}
          </p>
        </div>
        {PAGE_SHORTCUT_ACTIONS.map((action) => (
          <ShortcutListSection
            key={action}
            title={pageLabel(action, 'title')}
            description={pageLabel(action, 'description')}
            shortcuts={pageLists[action]}
            onChange={(next) => handlePageListChange(action, next)}
            getError={(s, i, list) => getShortcutError(s, i, list, action)}
            allowMidi={false}
            testId={`page-shortcuts-${pageId}-${action}`}
          />
        ))}
      </div>
    </div>
  )
}

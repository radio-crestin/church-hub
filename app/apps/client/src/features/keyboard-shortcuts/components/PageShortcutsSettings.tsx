import { Keyboard, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getDefaultSidebarItemSettings } from '~/features/sidebar-config/constants'
import { useSidebarConfig } from '~/features/sidebar-config/hooks/useSidebarConfig'
import type {
  BuiltInMenuItem,
  BuiltInMenuItemId,
  SidebarItemSettings,
} from '~/features/sidebar-config/types'
import { ShortcutRecorder } from './ShortcutRecorder'
import { useAppShortcuts } from '../hooks'
import type { GlobalShortcutActionId } from '../types'
import { VALID_ACTION_IDS } from '../utils'

interface PageShortcutsSettingsProps {
  /** The built-in page ID (e.g. 'songs', 'bible') */
  pageId: BuiltInMenuItemId
  /** Render the internal "Keyboard Shortcuts" heading (default true). */
  showHeading?: boolean
  /** Include the global "Display Selected Slide" section (default true). */
  includeShowSlide?: boolean
}

/**
 * Granular shortcut settings for a page (switch, focus search, display slide).
 * Hosted in the consolidated Shortcuts settings page.
 */
export function PageShortcutsSettings({
  pageId,
  showHeading = true,
  includeShowSlide = true,
}: PageShortcutsSettingsProps) {
  const { t } = useTranslation('settings')
  const { config, updateConfig } = useSidebarConfig()
  const { shortcuts: globalShortcuts, updateActionShortcuts } =
    useAppShortcuts()

  // Local state for the three shortcut types
  const [switchShortcuts, setSwitchShortcuts] = useState<string[]>([])
  const [focusSearchShortcuts, setFocusSearchShortcuts] = useState<string[]>([])
  const [showSlideShortcuts, setShowSlideShortcuts] = useState<string[]>([])

  // Find the sidebar item for this page
  const sidebarItem = useMemo(() => {
    if (!config) return null
    return config.items.find(
      (item) =>
        item.type === 'builtin' &&
        (item as BuiltInMenuItem).builtinId === pageId,
    )
  }, [config, pageId])

  // Load initial values from config
  useEffect(() => {
    if (!sidebarItem) return
    const settings =
      sidebarItem.settings ?? getDefaultSidebarItemSettings(pageId)

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

    // Load showSlide shortcuts from global config
    const showSlideConfig = globalShortcuts.actions.showSlide
    setShowSlideShortcuts([...(showSlideConfig?.shortcuts ?? [])])
  }, [sidebarItem, pageId, globalShortcuts.actions.showSlide])

  // Save sidebar item shortcuts (switch + focus search)
  const saveSidebarShortcuts = useCallback(
    (newSwitch: string[], newFocusSearch: string[]) => {
      if (!config || !sidebarItem) return

      const settings: SidebarItemSettings = {
        ...(sidebarItem.settings ?? getDefaultSidebarItemSettings(pageId)),
        shortcuts: newSwitch.filter((s) => s.trim()),
        focusSearchOnNavigate: false,
        focusSearchShortcuts: newFocusSearch.filter((s) => s.trim()),
      }

      const updatedItems = config.items.map((item) =>
        item.id === sidebarItem.id ? { ...item, settings } : item,
      )

      updateConfig.mutate({ ...config, items: updatedItems })
    },
    [config, sidebarItem, pageId, updateConfig],
  )

  // Validate shortcut for conflicts
  const getShortcutError = useCallback(
    (
      shortcut: string,
      index: number,
      sourceList: string[],
    ): string | undefined => {
      if (!shortcut) return undefined

      // Check for duplicates within the same list
      const duplicateIndex = sourceList.findIndex(
        (s, i) => i !== index && s === shortcut,
      )
      if (duplicateIndex !== -1) {
        return t('sections.sidebarItem.shortcuts.duplicateError')
      }

      // Check against global shortcuts (skip showSlide since it's displayed separately)
      for (const [actionId, actionConfig] of Object.entries(
        globalShortcuts.actions,
      )) {
        if (!VALID_ACTION_IDS.includes(actionId as GlobalShortcutActionId))
          continue
        if (actionId === 'showSlide') continue // Allow since we show it here
        if (actionConfig.shortcuts.includes(shortcut)) {
          return t('sections.sidebarItem.shortcuts.conflictGlobal', {
            action: actionId,
          })
        }
      }

      return undefined
    },
    [globalShortcuts, t],
  )

  // Switch shortcut handlers
  const handleAddSwitch = useCallback(() => {
    setSwitchShortcuts((prev) => [...prev, ''])
  }, [])

  const handleUpdateSwitch = useCallback(
    (index: number, value: string) => {
      setSwitchShortcuts((prev) => {
        const updated = [...prev]
        updated[index] = value
        saveSidebarShortcuts(updated, focusSearchShortcuts)
        return updated
      })
    },
    [focusSearchShortcuts, saveSidebarShortcuts],
  )

  const handleRemoveSwitch = useCallback(
    (index: number) => {
      setSwitchShortcuts((prev) => {
        const updated = prev.filter((_, i) => i !== index)
        saveSidebarShortcuts(updated, focusSearchShortcuts)
        return updated
      })
    },
    [focusSearchShortcuts, saveSidebarShortcuts],
  )

  // Focus search shortcut handlers
  const handleAddFocusSearch = useCallback(() => {
    setFocusSearchShortcuts((prev) => [...prev, ''])
  }, [])

  const handleUpdateFocusSearch = useCallback(
    (index: number, value: string) => {
      setFocusSearchShortcuts((prev) => {
        const updated = [...prev]
        updated[index] = value
        saveSidebarShortcuts(switchShortcuts, updated)
        return updated
      })
    },
    [switchShortcuts, saveSidebarShortcuts],
  )

  const handleRemoveFocusSearch = useCallback(
    (index: number) => {
      setFocusSearchShortcuts((prev) => {
        const updated = prev.filter((_, i) => i !== index)
        saveSidebarShortcuts(switchShortcuts, updated)
        return updated
      })
    },
    [switchShortcuts, saveSidebarShortcuts],
  )

  // Show slide shortcut handlers
  const handleAddShowSlide = useCallback(() => {
    setShowSlideShortcuts((prev) => [...prev, ''])
  }, [])

  const handleUpdateShowSlide = useCallback(
    (index: number, value: string) => {
      setShowSlideShortcuts((prev) => {
        const updated = [...prev]
        updated[index] = value
        updateActionShortcuts('showSlide', {
          shortcuts: updated.filter((s) => s.trim()),
          enabled: true,
        })
        return updated
      })
    },
    [updateActionShortcuts],
  )

  const handleRemoveShowSlide = useCallback(
    (index: number) => {
      setShowSlideShortcuts((prev) => {
        const updated = prev.filter((_, i) => i !== index)
        updateActionShortcuts('showSlide', {
          shortcuts: updated.filter((s) => s.trim()),
          enabled: true,
        })
        return updated
      })
    },
    [updateActionShortcuts],
  )

  return (
    <div className="space-y-4">
      {showHeading && (
        <div className="flex items-center gap-2 mb-2">
          <Keyboard className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('sections.sidebarItem.shortcuts.title')}
          </h3>
        </div>
      )}

      {/* Switch to Page Shortcuts */}
      <div className="space-y-2">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {t('sections.sidebarItem.shortcuts.switchTitle')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('sections.sidebarItem.shortcuts.switchDescription')}
          </p>
        </div>

        <div className="space-y-2">
          {switchShortcuts.map((shortcut, index) => (
            <ShortcutRecorder
              key={`switch-${index}`}
              value={shortcut}
              onChange={(value) => handleUpdateSwitch(index, value)}
              onRemove={() => handleRemoveSwitch(index)}
              error={getShortcutError(shortcut, index, switchShortcuts)}
              namespace="settings"
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddSwitch}
          className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          <Plus size={16} />
          {t('sections.shortcuts.addShortcut')}
        </button>
      </div>

      {/* Focus Search Shortcuts */}
      <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {t('sections.sidebarItem.shortcuts.focusSearchTitle')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('sections.sidebarItem.shortcuts.focusSearchDescription')}
          </p>
        </div>

        <div className="space-y-2">
          {focusSearchShortcuts.map((shortcut, index) => (
            <ShortcutRecorder
              key={`focus-${index}`}
              value={shortcut}
              onChange={(value) => handleUpdateFocusSearch(index, value)}
              onRemove={() => handleRemoveFocusSearch(index)}
              error={getShortcutError(shortcut, index, focusSearchShortcuts)}
              namespace="settings"
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddFocusSearch}
          className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          <Plus size={16} />
          {t('sections.shortcuts.addShortcut')}
        </button>
      </div>

      {/* Display Selected Slide Shortcuts */}
      {includeShowSlide && (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {t('sections.sidebarItem.shortcuts.showSlideTitle')}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t('sections.sidebarItem.shortcuts.showSlideDescription')}
            </p>
          </div>

          <div className="space-y-2">
            {showSlideShortcuts.map((shortcut, index) => (
              <ShortcutRecorder
                key={`show-${index}`}
                value={shortcut}
                onChange={(value) => handleUpdateShowSlide(index, value)}
                onRemove={() => handleRemoveShowSlide(index)}
                error={getShortcutError(shortcut, index, showSlideShortcuts)}
                namespace="settings"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddShowSlide}
            className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            <Plus size={16} />
            {t('sections.shortcuts.addShortcut')}
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
        {t('sections.sidebarItem.shortcuts.sameShortcutHint')}
      </p>
    </div>
  )
}

import {
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ShortcutRecorder } from '~/features/keyboard-shortcuts/components/ShortcutRecorder'
import { useAppShortcuts } from '~/features/keyboard-shortcuts/hooks'
import type { GlobalShortcutActionId } from '~/features/keyboard-shortcuts/types'
import { VALID_ACTION_IDS } from '~/features/keyboard-shortcuts/utils'
import { useOBSScenes } from '~/features/livestream/hooks'
import { ConfirmModal } from '~/ui/modal'
import { isTauri } from '~/utils/isTauri'
import { IconColorPicker } from './IconColorPicker'
import { IconPicker } from './IconPicker'
import {
  BUILTIN_ITEMS,
  DEFAULT_ICON_COLORS,
  getDefaultSidebarItemSettings,
  ICON_COLOR_HEX,
  PAGES_WITH_SEARCH,
} from '../constants'
import type {
  BuiltInMenuItem,
  CustomPageMenuItem,
  IconColor,
  IconSourceType,
  SidebarItemSettings,
  SidebarMenuItem,
} from '../types'
import { fetchFavicon } from '../utils/fetchFavicon'

interface SidebarItemSettingsModalProps {
  isOpen: boolean
  item: SidebarMenuItem | null
  onSave: (updates: SidebarItemSettingsUpdate) => void
  onDelete?: () => void
  onClose: () => void
}

export interface SidebarItemSettingsUpdate {
  itemId: string
  settings: SidebarItemSettings
  isVisible: boolean
  /** For custom pages only */
  customPageData?: {
    title: string
    url: string
    iconName: string
    useIframeEmbedding?: boolean
    customIconUrl?: string
    iconSource?: IconSourceType
    faviconColor?: string
  }
}

/**
 * Validates a URL string
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Unified settings modal for all sidebar items (built-in and custom)
 */
export function SidebarItemSettingsModal({
  isOpen,
  item,
  onSave,
  onDelete,
  onClose,
}: SidebarItemSettingsModalProps) {
  const { t } = useTranslation('settings')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)

  // Shortcuts validation context
  const { shortcuts: globalShortcuts } = useAppShortcuts()
  const { scenes } = useOBSScenes()

  // Form state
  const [shortcuts, setShortcuts] = useState<string[]>([])
  const [focusSearchShortcuts, setFocusSearchShortcuts] = useState<string[]>([])
  const [isVisible, setIsVisible] = useState(true)

  // Native window settings
  const [openInNativeWindow, setOpenInNativeWindow] = useState(false)
  const [autoOpenOnStartup, setAutoOpenOnStartup] = useState(false)
  const [forceNativeWindow, setForceNativeWindow] = useState(false)

  // Custom page fields
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [iconName, setIconName] = useState('Globe')
  const [useIframeEmbedding, setUseIframeEmbedding] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({})
  const [customIconUrl, setCustomIconUrl] = useState<string | undefined>()
  const [iconSource, setIconSource] = useState<IconSourceType>('favicon')
  const [isFetchingFavicon, setIsFetchingFavicon] = useState(false)
  const [faviconColor, setFaviconColor] = useState<string | undefined>()

  // Icon color
  const [iconColor, setIconColor] = useState<IconColor | undefined>('gray')
  const [customIconBgColor, setCustomIconBgColor] = useState<
    string | undefined
  >()

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isCustom = item?.type === 'custom'
  const isBuiltin = item?.type === 'builtin'

  // Determine if this page has search functionality
  const hasSearch = useMemo(() => {
    if (!item) return false
    if (isBuiltin) {
      return PAGES_WITH_SEARCH[(item as BuiltInMenuItem).builtinId]
    }
    return false // Custom pages don't have search
  }, [item, isBuiltin])

  // Get item display name
  const itemDisplayName = useMemo(() => {
    if (!item) return ''
    if (isCustom) {
      return (item as CustomPageMenuItem).title
    }
    const builtinId = (item as BuiltInMenuItem).builtinId
    const definition = BUILTIN_ITEMS[builtinId]
    return definition ? t(definition.labelKey) : builtinId
  }, [item, isCustom, t])

  // Reset form when modal opens or item changes
  useEffect(() => {
    if (isOpen && item) {
      const builtinId = isBuiltin
        ? (item as BuiltInMenuItem).builtinId
        : undefined
      const settings = item.settings ?? getDefaultSidebarItemSettings(builtinId)
      setShortcuts([...settings.shortcuts])
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
      setOpenInNativeWindow(settings.nativeWindow?.openInNativeWindow ?? false)
      setAutoOpenOnStartup(settings.nativeWindow?.autoOpenOnStartup ?? false)
      setForceNativeWindow(settings.nativeWindow?.forceNativeWindow ?? false)
      setIsVisible(item.isVisible)

      // Set icon color - use saved value, or default for built-in, or undefined for custom
      const defaultColor = builtinId
        ? DEFAULT_ICON_COLORS[builtinId]
        : undefined
      setIconColor(settings.iconColor ?? defaultColor)
      setCustomIconBgColor(settings.customIconBgColor)

      if (isCustom) {
        const customItem = item as CustomPageMenuItem
        setTitle(customItem.title)
        setUrl(customItem.url)
        setIconName(customItem.iconName)
        setUseIframeEmbedding(customItem.useIframeEmbedding ?? false)
        setCustomIconUrl(customItem.customIconUrl)
        setIconSource(customItem.iconSource ?? 'favicon')
        setFaviconColor(customItem.faviconColor)
      }
      setErrors({})
      setIsFetchingFavicon(false)
    }
  }, [isOpen, item, isBuiltin, isCustom])

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onClose()
    }
  }

  // Shortcut handlers
  const handleAddShortcut = useCallback(() => {
    setShortcuts((prev) => [...prev, ''])
  }, [])

  const handleUpdateShortcut = useCallback((index: number, value: string) => {
    setShortcuts((prev) => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }, [])

  const handleRemoveShortcut = useCallback((index: number) => {
    setShortcuts((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Focus search shortcut handlers
  const handleAddFocusSearchShortcut = useCallback(() => {
    setFocusSearchShortcuts((prev) => [...prev, ''])
  }, [])

  const handleUpdateFocusSearchShortcut = useCallback(
    (index: number, value: string) => {
      setFocusSearchShortcuts((prev) => {
        const updated = [...prev]
        updated[index] = value
        return updated
      })
    },
    [],
  )

  const handleRemoveFocusSearchShortcut = useCallback((index: number) => {
    setFocusSearchShortcuts((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Validate shortcut for conflicts (shared between switch and focus-search shortcuts)
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

      // Check against global shortcuts (only valid action IDs, ignore legacy ones)
      for (const [actionId, config] of Object.entries(
        globalShortcuts.actions,
      )) {
        if (!VALID_ACTION_IDS.includes(actionId as GlobalShortcutActionId)) {
          continue
        }
        if (config.shortcuts.includes(shortcut)) {
          return t('sections.sidebarItem.shortcuts.conflictGlobal', {
            action: actionId,
          })
        }
      }

      // Check against scene shortcuts
      for (const scene of scenes || []) {
        if (scene.shortcuts?.includes(shortcut)) {
          return t('sections.sidebarItem.shortcuts.conflictScene', {
            scene: scene.displayName,
          })
        }
      }

      return undefined
    },
    [globalShortcuts, scenes, t],
  )

  // Validate custom page fields
  const validateCustomPage = (): boolean => {
    if (!isCustom) return true

    const newErrors: { title?: string; url?: string } = {}

    if (!title.trim()) {
      newErrors.title = t('sections.sidebar.validation.titleRequired')
    }

    if (!url.trim()) {
      newErrors.url = t('sections.sidebar.validation.urlRequired')
    } else if (!isValidUrl(url)) {
      newErrors.url = t('sections.sidebar.validation.urlInvalid')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Fetch favicon from URL
  const handleFetchFavicon = useCallback(async () => {
    if (!url.trim() || !isValidUrl(url)) return

    setIsFetchingFavicon(true)
    try {
      const result = await fetchFavicon(url.trim())
      if (result) {
        setCustomIconUrl(result.dataUrl)
        setFaviconColor(result.dominantColor)
        setIconSource('favicon')
      }
    } finally {
      setIsFetchingFavicon(false)
    }
  }, [url])

  const handleSave = () => {
    if (!item) return

    // Validate custom page fields
    if (!validateCustomPage()) {
      return
    }

    // Filter out empty shortcuts
    const validShortcuts = shortcuts.filter((s) => s.trim())
    const validFocusSearchShortcuts = focusSearchShortcuts.filter((s) =>
      s.trim(),
    )

    const update: SidebarItemSettingsUpdate = {
      itemId: item.id,
      settings: {
        shortcuts: validShortcuts,
        focusSearchOnNavigate: false,
        focusSearchShortcuts: validFocusSearchShortcuts,
        nativeWindow: {
          openInNativeWindow,
          autoOpenOnStartup,
          forceNativeWindow,
        },
        iconColor,
        customIconBgColor,
      },
      isVisible,
    }

    if (isCustom) {
      update.customPageData = {
        title: title.trim(),
        url: url.trim(),
        iconName,
        useIframeEmbedding,
        customIconUrl: iconSource === 'favicon' ? customIconUrl : undefined,
        iconSource,
        faviconColor: iconSource === 'favicon' ? faviconColor : undefined,
      }
    }

    onSave(update)
  }

  const handleDelete = () => {
    setShowDeleteConfirm(false)
    onDelete?.()
  }

  if (!item) return null

  return (
    <>
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto p-0 rounded-xl border border-line shadow-popover backdrop:bg-black/50 bg-panel max-w-lg w-full max-h-[90vh] overflow-hidden"
        onClose={onClose}
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
      >
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-line">
            <h2 className="text-base font-semibold text-fg">
              {t('sections.sidebarItem.title', { itemName: itemDisplayName })}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-fg-hint hover:text-fg-label rounded-lg hover:bg-hover transition-colors"
            >
              <X strokeWidth={1.5} size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Switch to Page Shortcuts Section */}
            <div className="space-y-3">
              <div>
                <h3 className="text-[13px] font-medium text-fg">
                  {t('sections.sidebarItem.shortcuts.switchTitle')}
                </h3>
                <p className="text-xs text-fg-hint mt-0.5">
                  {t('sections.sidebarItem.shortcuts.switchDescription')}
                </p>
              </div>

              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <ShortcutRecorder
                    key={index}
                    value={shortcut}
                    onChange={(value) => handleUpdateShortcut(index, value)}
                    onRemove={() => handleRemoveShortcut(index)}
                    error={getShortcutError(shortcut, index, shortcuts)}
                    namespace="settings"
                    scopeKind="sidebar"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddShortcut}
                className="flex items-center gap-2 text-[13px] text-focus hover:underline"
              >
                <Plus size={16} strokeWidth={1.5} />
                {t('sections.shortcuts.addShortcut')}
              </button>
            </div>

            {/* Focus Search Shortcuts Section (only for pages with search) */}
            {hasSearch && (
              <div className="space-y-3 pt-2 border-t border-line">
                <div>
                  <h3 className="text-[13px] font-medium text-fg">
                    {t('sections.sidebarItem.shortcuts.focusSearchTitle')}
                  </h3>
                  <p className="text-xs text-fg-hint mt-0.5">
                    {t('sections.sidebarItem.shortcuts.focusSearchDescription')}
                  </p>
                </div>

                <div className="space-y-2">
                  {focusSearchShortcuts.map((shortcut, index) => (
                    <ShortcutRecorder
                      key={index}
                      value={shortcut}
                      onChange={(value) =>
                        handleUpdateFocusSearchShortcut(index, value)
                      }
                      onRemove={() => handleRemoveFocusSearchShortcut(index)}
                      error={getShortcutError(
                        shortcut,
                        index,
                        focusSearchShortcuts,
                      )}
                      namespace="settings"
                      scopeKind="sidebar"
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddFocusSearchShortcut}
                  className="flex items-center gap-2 text-[13px] text-focus hover:underline"
                >
                  <Plus size={16} strokeWidth={1.5} />
                  {t('sections.shortcuts.addShortcut')}
                </button>
              </div>
            )}

            {/* Icon Color Section */}
            <div className="space-y-3 pt-2 border-t border-line">
              <div>
                <h3 className="text-[13px] font-medium text-fg">
                  {t('sections.sidebarItem.iconColor.title')}
                </h3>
                <p className="text-xs text-fg-hint mt-0.5">
                  {t('sections.sidebarItem.iconColor.description')}
                </p>
              </div>
              <IconColorPicker
                value={iconColor}
                customColor={customIconBgColor}
                onChange={setIconColor}
                onCustomColorChange={setCustomIconBgColor}
                showCustomOption={isCustom}
              />
            </div>

            {/* Note: focusSearchOnNavigate toggle removed - replaced by separate focus search shortcuts */}

            {/* Visibility Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-line">
              <div>
                <h3 className="text-[13px] font-medium text-fg">
                  {t('sections.sidebarItem.visibility.label')}
                </h3>
                <p className="text-xs text-fg-hint">
                  {t('sections.sidebarItem.visibility.description')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsVisible(!isVisible)}
                className={`p-2 rounded-lg transition-colors ${
                  isVisible
                    ? 'text-fg-label hover:bg-hover hover:text-fg'
                    : 'text-fg-hint hover:bg-hover'
                }`}
              >
                {isVisible ? (
                  <Eye size={16} strokeWidth={1.5} />
                ) : (
                  <EyeOff size={16} strokeWidth={1.5} />
                )}
              </button>
            </div>

            {/* Native Window Settings (Tauri only) */}
            {isTauri() && (
              <div className="space-y-4 pt-4 border-t border-line">
                <h3 className="text-[13px] font-medium text-fg">
                  {t('sections.sidebarItem.nativeWindow.title')}
                </h3>

                {/* Enable Native Window Toggle */}
                <div className="flex items-start gap-3">
                  <input
                    id="open-in-native-window"
                    type="checkbox"
                    checked={openInNativeWindow}
                    onChange={(e) => {
                      setOpenInNativeWindow(e.target.checked)
                      // If disabling, also disable auto-open
                      if (!e.target.checked) {
                        setAutoOpenOnStartup(false)
                      }
                    }}
                    className="mt-1 h-4 w-4 rounded border-line accent-primary text-primary focus:ring-focus"
                  />
                  <div className="flex flex-col">
                    <label
                      htmlFor="open-in-native-window"
                      className="text-[13px] font-medium text-fg-body cursor-pointer"
                    >
                      {t('sections.sidebarItem.nativeWindow.enableLabel')}
                    </label>
                    <p className="text-xs text-fg-hint">
                      {t('sections.sidebarItem.nativeWindow.enableDescription')}
                    </p>
                  </div>
                </div>

                {/* Auto-open on Startup Toggle (nested under native window) */}
                {openInNativeWindow && (
                  <div className="flex items-start gap-3 ml-7">
                    <input
                      id="auto-open-startup"
                      type="checkbox"
                      checked={autoOpenOnStartup}
                      onChange={(e) => setAutoOpenOnStartup(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-line accent-primary text-primary focus:ring-focus"
                    />
                    <div className="flex flex-col">
                      <label
                        htmlFor="auto-open-startup"
                        className="text-[13px] font-medium text-fg-body cursor-pointer"
                      >
                        {t('sections.sidebarItem.nativeWindow.autoOpenLabel')}
                      </label>
                      <p className="text-xs text-fg-hint">
                        {t(
                          'sections.sidebarItem.nativeWindow.autoOpenDescription',
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Force Native Window Toggle (nested under native window) */}
                {openInNativeWindow && (
                  <div className="flex items-start gap-3 ml-7">
                    <input
                      id="force-native-window"
                      type="checkbox"
                      checked={forceNativeWindow}
                      onChange={(e) => setForceNativeWindow(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-line accent-primary text-primary focus:ring-focus"
                    />
                    <div className="flex flex-col">
                      <label
                        htmlFor="force-native-window"
                        className="text-[13px] font-medium text-fg-body cursor-pointer"
                      >
                        {t('sections.sidebarItem.nativeWindow.forceLabel')}
                      </label>
                      <p className="text-xs text-fg-hint">
                        {t(
                          'sections.sidebarItem.nativeWindow.forceDescription',
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom Page Settings */}
            {isCustom && (
              <div className="space-y-4 pt-4 border-t border-line">
                <h3 className="text-[13px] font-medium text-fg">
                  {t('sections.sidebarItem.customPage.title')}
                </h3>

                {/* Title Input */}
                <div className="space-y-1">
                  <label
                    htmlFor="custom-page-title"
                    className="text-[13px] font-medium text-fg-body"
                  >
                    {t('sections.sidebar.fields.title')}
                  </label>
                  <input
                    id="custom-page-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('sections.sidebar.fields.titlePlaceholder')}
                    className={`
                      block w-full h-9 px-3 bg-field
                      border text-fg text-[13px] rounded-[10px]
                      focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus
                      placeholder:text-fg-hint
                      ${errors.title ? 'border-red-500' : 'border-transparent'}
                    `}
                  />
                  {errors.title && (
                    <p className="text-[13px] text-red-500">{errors.title}</p>
                  )}
                </div>

                {/* URL Input */}
                <div className="space-y-1">
                  <label
                    htmlFor="custom-page-url"
                    className="text-[13px] font-medium text-fg-body"
                  >
                    {t('sections.sidebar.fields.url')}
                  </label>
                  <input
                    id="custom-page-url"
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t('sections.sidebar.fields.urlPlaceholder')}
                    className={`
                      block w-full h-9 px-3 bg-field
                      border text-fg text-[13px] rounded-[10px]
                      focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus
                      placeholder:text-fg-hint
                      ${errors.url ? 'border-red-500' : 'border-transparent'}
                    `}
                  />
                  {errors.url && (
                    <p className="text-[13px] text-red-500">{errors.url}</p>
                  )}
                </div>

                {/* Icon Source Selection */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-[13px] font-medium text-fg-body">
                      {t('sections.sidebar.fields.icon')}
                    </h4>
                    <p className="text-xs text-fg-hint mt-0.5">
                      {t('sections.sidebar.fields.iconSourceDescription')}
                    </p>
                  </div>

                  {/* Icon Source Toggle */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIconSource('favicon')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[13px] rounded-lg border transition-colors ${
                        iconSource === 'favicon'
                          ? 'bg-selected border-transparent text-fg'
                          : 'bg-field border-transparent text-fg-body hover:bg-hover'
                      }`}
                    >
                      <Globe size={16} strokeWidth={1.5} />
                      {t('sections.sidebar.fields.useFavicon')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIconSource('icon')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[13px] rounded-lg border transition-colors ${
                        iconSource === 'icon'
                          ? 'bg-selected border-transparent text-fg'
                          : 'bg-field border-transparent text-fg-body hover:bg-hover'
                      }`}
                    >
                      {t('sections.sidebar.fields.useCustomIcon')}
                    </button>
                  </div>

                  {/* Favicon Section */}
                  {iconSource === 'favicon' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        {/* Favicon Preview */}
                        <div
                          className="w-12 h-12 rounded-lg border border-line flex items-center justify-center overflow-hidden"
                          style={{
                            backgroundColor: customIconUrl
                              ? (customIconBgColor ??
                                (iconColor
                                  ? ICON_COLOR_HEX[iconColor]
                                  : (faviconColor ?? '#6366f1')))
                              : undefined,
                          }}
                        >
                          {isFetchingFavicon ? (
                            <Loader2
                              strokeWidth={1.5}
                              size={16}
                              className="text-fg-hint animate-spin"
                            />
                          ) : customIconUrl ? (
                            <img
                              src={customIconUrl}
                              alt="Favicon"
                              className="w-7 h-7 object-contain"
                            />
                          ) : (
                            <Globe
                              strokeWidth={1.5}
                              size={16}
                              className="text-fg-hint"
                            />
                          )}
                        </div>

                        {/* Fetch Button */}
                        <button
                          type="button"
                          onClick={handleFetchFavicon}
                          disabled={
                            isFetchingFavicon ||
                            !url.trim() ||
                            !isValidUrl(url.trim())
                          }
                          className="flex items-center gap-2 px-3 py-2 text-[13px] bg-field hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-fg-body"
                        >
                          {isFetchingFavicon ? (
                            <Loader2
                              strokeWidth={1.5}
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <RefreshCw strokeWidth={1.5} size={16} />
                          )}
                          {customIconUrl
                            ? t('sections.sidebar.fields.refetchFavicon')
                            : t('sections.sidebar.fields.fetchFavicon')}
                        </button>
                      </div>

                      {!customIconUrl && !isFetchingFavicon && (
                        <p className="text-xs text-fg-hint">
                          {t('sections.sidebar.fields.faviconHint')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Icon Picker (when using custom icon) */}
                  {iconSource === 'icon' && (
                    <IconPicker value={iconName} onChange={setIconName} />
                  )}
                </div>

                {/* Iframe Embedding Toggle */}
                <div className="flex items-start gap-3">
                  <input
                    id="use-iframe-embedding"
                    type="checkbox"
                    checked={useIframeEmbedding}
                    onChange={(e) => setUseIframeEmbedding(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-line accent-primary text-primary focus:ring-focus"
                  />
                  <div className="flex flex-col">
                    <label
                      htmlFor="use-iframe-embedding"
                      className="text-[13px] font-medium text-fg-body cursor-pointer"
                    >
                      {t('sections.sidebar.fields.useIframeEmbedding')}
                    </label>
                    <p className="text-xs text-fg-hint">
                      {t('sections.sidebar.fields.useIframeEmbeddingHint')}
                    </p>
                  </div>
                </div>

                {/* Delete Section */}
                {onDelete && (
                  <div className="pt-4 border-t border-line">
                    <h4 className="text-[13px] font-medium text-red-600 dark:text-red-400 mb-2">
                      {t('sections.sidebarItem.customPage.dangerZone')}
                    </h4>
                    <p className="text-xs text-fg-hint mb-3">
                      {t('sections.sidebarItem.customPage.deleteDescription')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-hover rounded-lg transition-colors"
                    >
                      <Trash2 strokeWidth={1.5} size={16} />
                      {t('sections.sidebar.modals.delete.confirm')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 text-[13px] font-medium bg-field text-fg hover:bg-hover rounded-lg transition-colors"
            >
              {t('common:buttons.cancel', { defaultValue: 'Cancel' })}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-9 px-3.5 text-[13px] bg-primary hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              {t('common:buttons.save', { defaultValue: 'Save' })}
            </button>
          </div>
        </div>
      </dialog>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={t('sections.sidebar.modals.delete.title')}
        message={t('sections.sidebar.modals.delete.message', {
          name: isCustom ? (item as CustomPageMenuItem).title : '',
        })}
        confirmLabel={t('sections.sidebar.modals.delete.confirm')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </>
  )
}

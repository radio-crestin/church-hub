import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, Settings, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  formatShortcutForDisplay,
  isMIDIShortcut,
} from '~/features/keyboard-shortcuts'
import {
  BUILTIN_ITEMS,
  DEFAULT_ICON_COLORS,
  ICON_COLOR_CLASSES,
  ICON_COLOR_HEX,
} from '../constants'
import { getIconComponent } from '../hooks/useResolvedSidebarItems'
import type { CustomPageMenuItem, SidebarMenuItem } from '../types'

interface SidebarItemCardProps {
  item: SidebarMenuItem
  onToggleVisibility: () => void
  onOpenSettings: () => void
  onDelete?: () => void
}

/**
 * Card component for a single sidebar item with drag-and-drop support
 */
export function SidebarItemCard({
  item,
  onToggleVisibility,
  onOpenSettings,
  onDelete,
}: SidebarItemCardProps) {
  const { t } = useTranslation(['settings', 'sidebar'])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isBuiltin = item.type === 'builtin'
  const isCustom = item.type === 'custom'

  // Get icon and label
  let Icon
  let label: string
  let customIconUrl: string | undefined
  let faviconBgColor: string | undefined
  let iconColorClasses: { bg: string; text: string } | null = null

  if (isBuiltin) {
    const definition = BUILTIN_ITEMS[item.builtinId]
    Icon = definition?.icon
    label = t(definition?.labelKey ?? '')
    // Get icon color - saved value or default
    const iconColor =
      item.settings?.iconColor ?? DEFAULT_ICON_COLORS[item.builtinId]
    if (iconColor) {
      iconColorClasses = ICON_COLOR_CLASSES[iconColor]
    }
  } else {
    const customItem = item as CustomPageMenuItem
    Icon = getIconComponent(customItem.iconName)
    label = customItem.title
    // Get custom icon URL if using favicon
    if (customItem.iconSource === 'favicon' && customItem.customIconUrl) {
      customIconUrl = customItem.customIconUrl
      // Compute favicon background color (priority order):
      // 1. customIconBgColor - user's custom hex color
      // 2. iconColor - predefined color from settings
      // 3. faviconColor - extracted color from the favicon
      const customBgColor = item.settings?.customIconBgColor
      const iconColor = item.settings?.iconColor
      faviconBgColor =
        customBgColor ??
        (iconColor ? ICON_COLOR_HEX[iconColor] : undefined) ??
        customItem.faviconColor
    }
    // Get icon color if set (for non-favicon icons)
    const iconColor = item.settings?.iconColor
    if (iconColor && !customIconUrl) {
      iconColorClasses = ICON_COLOR_CLASSES[iconColor]
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700 rounded-lg
        ${isDragging ? 'shadow-lg ring-2 ring-indigo-500' : ''}
        ${!item.isVisible ? 'opacity-60' : ''}
      `}
    >
      {/* Drag Handle */}
      <button
        type="button"
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={20} />
      </button>

      {/* Icon */}
      {customIconUrl ? (
        <div
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md"
          style={{ backgroundColor: faviconBgColor ?? '#6366f1' }}
        >
          <img src={customIconUrl} alt="" className="w-5 h-5 object-contain" />
        </div>
      ) : Icon && iconColorClasses ? (
        <div
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md ${iconColorClasses.bg}`}
        >
          <Icon size={18} className={iconColorClasses.text} />
        </div>
      ) : Icon ? (
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
          <Icon size={18} />
        </div>
      ) : null}

      {/* Label and Type Badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white truncate">
            {label}
          </span>
          <span
            className={`
              text-xs px-1.5 py-0.5 rounded
              ${isBuiltin ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'}
            `}
          >
            {isBuiltin
              ? t('settings:sections.sidebar.builtIn')
              : t('settings:sections.sidebar.custom')}
          </span>
        </div>
        {isCustom && (
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">
            {item.url}
          </span>
        )}
      </div>

      {/* Shortcuts and Actions */}
      <div className="flex items-center gap-1">
        {/* Shortcuts display */}
        {item.settings?.shortcuts && item.settings.shortcuts.length > 0 && (
          <div className="flex items-center gap-1 mr-2">
            {item.settings.shortcuts.map((shortcut) => (
              <kbd
                key={shortcut}
                className={`
                  text-xs px-1.5 py-0.5 rounded font-mono
                  ${
                    isMIDIShortcut(shortcut)
                      ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
                      : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                  }
                `}
              >
                {formatShortcutForDisplay(shortcut)}
              </kbd>
            ))}
          </div>
        )}
        {/* Delete Button (custom pages only) */}
        {isCustom && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title={t('common:buttons.delete', { defaultValue: 'Delete' })}
          >
            <Trash2 size={18} />
          </button>
        )}

        {/* Visibility Toggle */}
        <button
          type="button"
          onClick={onToggleVisibility}
          className={`
            p-2 rounded-lg transition-colors
            ${
              item.isVisible
                ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }
          `}
          title={
            item.isVisible
              ? t('settings:sections.sidebar.visible')
              : t('settings:sections.sidebar.hidden')
          }
        >
          {item.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>

        {/* Settings Button (all items) */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
          title={t('common:buttons.settings', { defaultValue: 'Settings' })}
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  )
}

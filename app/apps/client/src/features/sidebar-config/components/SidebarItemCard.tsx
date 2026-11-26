import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Eye,
  EyeOff,
  GripVertical,
  type LucideIcon,
  Settings,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatShortcutForDisplay } from '~/features/keyboard-shortcuts'
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
  let Icon: LucideIcon
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
        flex items-center gap-3 p-3 bg-panel
        border border-line rounded-lg
        ${isDragging ? 'bg-selected shadow-popover' : ''}
        ${!item.isVisible ? 'opacity-60' : ''}
      `}
    >
      {/* Drag Handle */}
      <button
        type="button"
        className="p-1 text-fg-hint hover:text-fg-label cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} strokeWidth={1.5} />
      </button>

      {/* Icon */}
      {customIconUrl ? (
        <div
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md"
          style={{ backgroundColor: faviconBgColor ?? '#6366f1' }}
        >
          <img src={customIconUrl} alt="" className="w-5 h-5 object-contain" />
        </div>
      ) : iconColorClasses ? (
        <div
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md ${iconColorClasses.bg}`}
        >
          <Icon size={18} className={iconColorClasses.text} />
        </div>
      ) : (
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-fg-label">
          <Icon size={16} strokeWidth={1.5} />
        </div>
      )}

      {/* Label, then its type badge and shortcuts under it */}
      <div className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-fg truncate">
          {label}
        </span>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <span
            className={`
              text-xs text-fg-hint
            `}
          >
            {isBuiltin
              ? t('settings:sections.sidebar.builtIn')
              : t('settings:sections.sidebar.custom')}
          </span>
          {item.settings?.shortcuts?.map((shortcut) => (
            <kbd
              key={shortcut}
              className={`
                inline-flex h-[18px] min-w-5 items-center justify-center rounded-[5px] bg-keycap px-[5px] text-[11px] font-medium text-fg-label shadow-[inset_0_0_0_1px_var(--color-keycap-ring)]
              `}
            >
              {formatShortcutForDisplay(shortcut)}
            </kbd>
          ))}
        </div>
        {isCustom && (
          <span className="text-xs text-fg-hint truncate block">
            {item.url}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center">
        {/* Delete Button (custom pages only) */}
        {isCustom && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center text-fg-label hover:text-red-600 dark:hover:text-red-400 hover:bg-hover rounded-lg transition-colors"
            title={t('common:buttons.delete', { defaultValue: 'Delete' })}
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        )}

        {/* Visibility Toggle */}
        <button
          type="button"
          onClick={onToggleVisibility}
          className={`
            flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-hover hover:text-fg
            ${item.isVisible ? 'text-fg-label' : 'text-fg-hint'}
          `}
          title={
            item.isVisible
              ? t('settings:sections.sidebar.visible')
              : t('settings:sections.sidebar.hidden')
          }
        >
          {item.isVisible ? (
            <Eye size={16} strokeWidth={1.5} />
          ) : (
            <EyeOff size={16} strokeWidth={1.5} />
          )}
        </button>

        {/* Settings Button (all items) */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-8 w-8 items-center justify-center text-fg-label hover:text-fg hover:bg-hover rounded-lg transition-colors"
          title={t('common:buttons.settings')}
        >
          <Settings size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

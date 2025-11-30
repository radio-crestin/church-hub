import { ExternalLink, Monitor, Palette, Power, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Display } from '../types'

interface DisplayCardProps {
  display: Display
  onEdit: (display: Display) => void
  onTheme: (display: Display) => void
  onDelete: (display: Display) => void
  onToggleActive: (display: Display) => void
}

function openDisplayWindow(displayId: number) {
  const width = 1280
  const height = 720
  const left = window.screen.width / 2 - width / 2
  const top = window.screen.height / 2 - height / 2

  window.open(
    `/display/${displayId}`,
    `display-${displayId}`,
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
  )
}

export function DisplayCard({
  display,
  onEdit,
  onTheme,
  onDelete,
  onToggleActive,
}: DisplayCardProps) {
  const { t } = useTranslation('presentation')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-8 rounded border-2 flex items-center justify-center"
            style={{
              backgroundColor:
                display.theme.backgroundType === 'color'
                  ? display.theme.backgroundColor
                  : display.theme.backgroundType === 'transparent'
                    ? 'transparent'
                    : '#333',
              borderColor: display.isActive ? '#22c55e' : '#9ca3af',
              backgroundImage:
                display.theme.backgroundType === 'image' &&
                display.theme.backgroundImage
                  ? `url(${display.theme.backgroundImage})`
                  : undefined,
              backgroundSize: 'cover',
            }}
          >
            <Monitor
              size={16}
              style={{ color: display.theme.textColor || '#fff' }}
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => onEdit(display)}
              className="font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 text-left"
            >
              {display.name}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {display.isActive ? t('displays.active') : t('displays.inactive')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openDisplayWindow(display.id)}
            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            title={t('displays.openWindow')}
          >
            <ExternalLink size={18} />
          </button>
          <button
            type="button"
            onClick={() => onToggleActive(display)}
            className={`p-2 rounded-lg transition-colors ${
              display.isActive
                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={
              display.isActive
                ? t('displays.deactivate')
                : t('displays.activate')
            }
          >
            <Power size={18} />
          </button>
          <button
            type="button"
            onClick={() => onTheme(display)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={t('displays.editTheme')}
          >
            <Palette size={18} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(display)}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title={t('actions.delete')}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

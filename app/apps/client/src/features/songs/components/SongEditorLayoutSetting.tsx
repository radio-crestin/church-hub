import { LayoutList, Projector } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { type SongEditorLayout, useSongEditorLayout } from '../hooks'

interface LayoutOption {
  value: SongEditorLayout
  labelKey: string
  descKey: string
  icon: typeof LayoutList
}

const OPTIONS: LayoutOption[] = [
  {
    value: 'normal',
    labelKey: 'editorLayout.normal',
    descKey: 'editorLayout.normalDesc',
    icon: LayoutList,
  },
  {
    value: 'powerpoint',
    labelKey: 'editorLayout.powerpoint',
    descKey: 'editorLayout.powerpointDesc',
    icon: Projector,
  },
]

/**
 * Per-device preference choosing how songs are edited: the existing form /
 * first-column editing ("normal"), or the PowerPoint-style stage editor shown
 * directly on the song page ("powerpoint").
 */
export function SongEditorLayoutSetting() {
  const { t } = useTranslation('songs')
  const [layout, setLayout] = useSongEditorLayout()

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {t('editorLayout.title')}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {t('editorLayout.description')}
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon
          const active = layout === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setLayout(option.value)}
              aria-pressed={active}
              className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
                active
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Icon
                size={20}
                className={
                  active
                    ? 'text-indigo-600 dark:text-indigo-400 shrink-0'
                    : 'text-gray-400 shrink-0'
                }
              />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  {t(option.labelKey)}
                </span>
                <span className="block mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t(option.descKey)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

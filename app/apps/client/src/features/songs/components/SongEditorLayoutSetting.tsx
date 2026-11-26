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
      <h3 className="text-base font-semibold text-fg">
        {t('editorLayout.title')}
      </h3>
      <p className="mt-1 text-sm text-fg-hint">
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
                  ? 'border-line-strong bg-selected'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              <Icon
                size={20}
                className={
                  active ? 'text-fg-label shrink-0' : 'text-fg-hint shrink-0'
                }
              />
              <span>
                <span className="block text-sm font-medium text-fg">
                  {t(option.labelKey)}
                </span>
                <span className="block mt-0.5 text-xs text-fg-hint">
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

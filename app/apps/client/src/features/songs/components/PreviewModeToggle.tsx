import { Eye, MonitorPlay } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface PreviewModeToggleProps {
  previewMode: boolean
  onTogglePreviewMode: () => void
}

/**
 * Two icons for how a click on a verse behaves: live (green, like the live
 * verse) shows it on screen at once; preview (indigo, like the staged verse)
 * stages it here first, for the singers, until Afișează projects it.
 */
export function PreviewModeToggle({
  previewMode,
  onTogglePreviewMode,
}: PreviewModeToggleProps) {
  const { t } = useTranslation('songs')
  const modes = [
    {
      id: 'live',
      isActive: !previewMode,
      Icon: MonitorPlay,
      label: t('preview.liveMode'),
      hint: t('preview.liveModeHint'),
      activeClass: 'bg-green-600 text-white',
    },
    {
      id: 'preview',
      isActive: previewMode,
      Icon: Eye,
      label: t('preview.previewMode'),
      hint: t('preview.previewModeHint'),
      activeClass: 'bg-indigo-600 text-white',
    },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={t('preview.modeLabel')}
      data-testid="song-mode-toggle"
      className="flex shrink-0 gap-0.5 rounded-lg border border-gray-300 p-0.5 dark:border-gray-600"
    >
      {modes.map(({ id, isActive, Icon, label, hint, activeClass }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={isActive}
          aria-label={label}
          title={hint}
          data-testid={`song-mode-${id}`}
          onClick={() => {
            if (!isActive) onTogglePreviewMode()
          }}
          className={`flex items-center rounded-md p-1.5 transition-colors ${
            isActive
              ? activeClass
              : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  )
}

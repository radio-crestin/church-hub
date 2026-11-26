import { Eye, MonitorPlay } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface PreviewModeToggleProps {
  previewMode: boolean
  onTogglePreviewMode: () => void
}

/**
 * Two icons for how a click on a verse behaves: live shows it on screen at
 * once; preview stages it here first, for the singers, until Afișează projects it.
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
    },
    {
      id: 'preview',
      isActive: previewMode,
      Icon: Eye,
      label: t('preview.previewMode'),
      hint: t('preview.previewModeHint'),
    },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={t('preview.modeLabel')}
      data-testid="song-mode-toggle"
      className="flex shrink-0 gap-0.5 rounded-lg bg-field p-0.5"
    >
      {modes.map(({ id, isActive, Icon, label, hint }) => (
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
            isActive ? 'bg-selected text-fg' : 'text-fg-label hover:text-fg'
          }`}
        >
          <Icon size={16} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  )
}

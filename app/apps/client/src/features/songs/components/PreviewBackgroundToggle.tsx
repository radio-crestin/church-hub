import { ImageIcon, ImageOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface PreviewBackgroundToggleProps {
  /** Whether the preview shows plain black instead of the background */
  hidden: boolean
  onToggle: () => void
}

/**
 * Hides the background in the song page's previews, so the lyrics are easy to
 * read. Pressed = hidden. The screens keep their background either way.
 */
export function PreviewBackgroundToggle({
  hidden,
  onToggle,
}: PreviewBackgroundToggleProps) {
  const { t } = useTranslation('songs')

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={t('preview.hideBackground')}
      title={t('preview.hideBackground')}
      data-testid="song-preview-hide-background"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        hidden
          ? 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
          : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
      }`}
    >
      {hidden ? <ImageOff size={16} /> : <ImageIcon size={16} />}
      <span className="hidden sm:inline">{t('preview.background')}</span>
    </button>
  )
}

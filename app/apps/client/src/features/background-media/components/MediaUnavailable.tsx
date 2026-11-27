import { ImageOff, VideoOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface MediaUnavailableProps {
  kind: 'image' | 'video'
  /** A small label in the corner (over a background), else filling its box. */
  compact?: boolean
}

/**
 * Where a picture or video would be, when this device can't load it (a
 * phone with the church PC off, a file the PC didn't publish): says so,
 * quietly, instead of an empty or broken frame.
 */
export function MediaUnavailable({
  kind,
  compact = false,
}: MediaUnavailableProps) {
  const { t } = useTranslation('presentation')
  const Icon = kind === 'video' ? VideoOff : ImageOff
  const label = t(`screens.background.unavailable.${kind}`)

  if (compact) {
    return (
      <div
        data-testid="media-unavailable"
        data-media-kind={kind}
        role="img"
        aria-label={label}
        title={t('screens.background.unavailable.hint')}
        className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-panel/90 px-2 py-1 text-xs text-fg-hint"
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
    )
  }
  return (
    <div
      data-testid="media-unavailable"
      data-media-kind={kind}
      role="img"
      aria-label={label}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-field p-4 text-center text-fg-hint"
    >
      <Icon className="size-8 shrink-0" aria-hidden />
      <span className="text-sm font-medium text-fg">{label}</span>
      <span className="text-xs">
        {t('screens.background.unavailable.hint')}
      </span>
    </div>
  )
}

import { Repeat } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface PlaylistRunnerStateProps {
  /** The runner is moving this presentation on by itself. */
  isRunning: boolean
  /** The presentation starts again after its last slide. */
  loops: boolean
}

/**
 * What a presentation that runs by itself is doing: running or not, and
 * whether it starts again after its last slide.
 */
export function PlaylistRunnerState({
  isRunning,
  loops,
}: PlaylistRunnerStateProps) {
  const { t } = useTranslation('schedules')

  return (
    <>
      {isRunning && (
        <span
          className="flex items-center gap-1 rounded bg-field px-1.5 py-0.5 font-medium text-fg-body"
          data-testid="playlist-running"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
          {t('playlist.running')}
        </span>
      )}
      {loops && (
        <span
          className="flex items-center gap-1 rounded bg-field px-1.5 py-0.5 text-fg-label"
          data-testid="playlist-looping"
          title={t('automation.loopDescription')}
        >
          <Repeat size={12} strokeWidth={2} />
          {t('automation.summary.loop')}
        </span>
      )}
    </>
  )
}

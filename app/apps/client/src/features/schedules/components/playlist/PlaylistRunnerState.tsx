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
          className="rounded bg-green-600 px-1.5 py-0.5 font-medium text-white"
          data-testid="playlist-running"
        >
          {t('playlist.running')}
        </span>
      )}
      {loops && (
        <span
          className="flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
          data-testid="playlist-looping"
          title={t('automation.loopDescription')}
        >
          <Repeat size={12} />
          {t('automation.summary.loop')}
        </span>
      )}
    </>
  )
}

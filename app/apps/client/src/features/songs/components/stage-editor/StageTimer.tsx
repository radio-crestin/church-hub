import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { usePresentationSessionElapsed } from '~/features/presentation'
import { formatElapsed } from '../../utils/formatElapsed'

/**
 * Live presentation-session clock. Shows how long the current presentation has
 * been on screen (across song switches), and renders nothing while nothing is
 * being projected.
 */
export function StageTimer() {
  const { t } = useTranslation('songs')
  const elapsed = usePresentationSessionElapsed()

  if (elapsed === null) return null

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900/80 px-2.5 py-1 font-mono text-sm tabular-nums text-white shadow-md backdrop-blur-sm dark:bg-white/85 dark:text-gray-900"
      title={t('stageEditor.elapsed')}
      aria-label={t('stageEditor.elapsed')}
      data-testid="stage-timer"
    >
      <Clock size={14} />
      {formatElapsed(elapsed)}
    </div>
  )
}

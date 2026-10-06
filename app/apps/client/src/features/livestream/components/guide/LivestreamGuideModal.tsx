import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { BrowserSourceStep } from './BrowserSourceStep'
import { ConnectObsStep } from './ConnectObsStep'
import { FirstSceneStep } from './FirstSceneStep'
import { MidiStep } from './MidiStep'
import { MixerStep } from './MixerStep'
import { SwitchScenesStep } from './SwitchScenesStep'
import { YouTubeStep } from './YouTubeStep'

interface LivestreamGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Walks a church through the livestream setup: OBS, Church Hub's screen in
 * OBS, the first scene, switching scenes, MIDI, the mixer and YouTube. Each
 * step ticks itself once Church Hub can see it done.
 */
export function LivestreamGuideModal({
  isOpen,
  onClose,
}: LivestreamGuideModalProps) {
  const { t } = useTranslation('livestream')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="livestream-guide-title"
      className="fixed inset-0 m-auto w-full max-w-2xl rounded-lg bg-white p-0 shadow-xl backdrop:bg-black/50 dark:bg-gray-800 max-h-[90vh]"
      // The OBS and mixer setups open inside the guide: their close and
      // clicks bubble up the React tree, and must not close the guide too.
      onClose={(e) => e.target === dialogRef.current && onClose()}
      onClick={(e) => e.target === dialogRef.current && onClose()}
    >
      {isOpen && (
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-4 sm:p-6 dark:border-gray-700">
            <div>
              <h2
                id="livestream-guide-title"
                className="text-xl font-semibold text-gray-900 dark:text-white"
              >
                {t('guide.title')}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {t('guide.intro')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('guide.close')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <ol className="space-y-6 overflow-y-auto p-4 sm:p-6">
            <ConnectObsStep number={1} />
            <BrowserSourceStep number={2} onNavigate={onClose} />
            <FirstSceneStep number={3} />
            <SwitchScenesStep number={4} onNavigate={onClose} />
            <MidiStep number={5} onNavigate={onClose} />
            <MixerStep number={6} />
            <YouTubeStep number={7} />
          </ol>
        </div>
      )}
    </dialog>
  )
}

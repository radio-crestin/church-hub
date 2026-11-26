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
      className="fixed inset-0 m-auto w-full max-w-2xl rounded-xl border border-line bg-panel p-0 shadow-xl backdrop:bg-black/50 max-h-[90vh]"
      // The OBS and mixer setups open inside the guide: their close and
      // clicks bubble up the React tree, and must not close the guide too.
      onClose={(e) => e.target === dialogRef.current && onClose()}
      onClick={(e) => e.target === dialogRef.current && onClose()}
    >
      {isOpen && (
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line p-4 sm:p-6">
            <div>
              <h2
                id="livestream-guide-title"
                className="text-base font-semibold text-fg"
              >
                {t('guide.title')}
              </h2>
              <p className="mt-1 text-sm text-fg-label">{t('guide.intro')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('guide.close')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg"
            >
              <X size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
          <ol className="space-y-6 overflow-y-auto p-4 sm:p-6">
            <ConnectObsStep number={1} onNavigate={onClose} />
            <BrowserSourceStep number={2} onNavigate={onClose} />
            <FirstSceneStep number={3} />
            <SwitchScenesStep number={4} onNavigate={onClose} />
            <MidiStep number={5} onNavigate={onClose} />
            <MixerStep number={6} onNavigate={onClose} />
            <YouTubeStep number={7} onNavigate={onClose} />
          </ol>
        </div>
      )}
    </dialog>
  )
}

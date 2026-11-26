import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { BackgroundMediaPicker } from '~/features/background-media/components/BackgroundMediaPicker'
import type { BackgroundMediaSelection } from '~/features/background-media/service'

interface MediaPickerDialogProps {
  kind: 'image' | 'video'
  onPick: (selection: BackgroundMediaSelection) => void
  onClose: () => void
}

/** A picture or video picked from the gallery (or uploaded to it). */
export function MediaPickerDialog({
  kind,
  onPick,
  onClose,
}: MediaPickerDialogProps) {
  const { t } = useTranslation('schedules')
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])
  return (
    <dialog
      ref={dialogRef}
      data-testid="deck-editor-media-dialog"
      onClose={onClose}
      className="m-auto w-[min(40rem,95vw)] rounded-xl border border-line bg-panel p-0 shadow-popover backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold text-fg">
          {kind === 'image'
            ? t('deckEditor.choosePicture')
            : t('deckEditor.chooseVideo')}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg"
          aria-label={t('common:buttons.done')}
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-4">
        <BackgroundMediaPicker
          kind={kind}
          onChange={(selection) => {
            if (!selection.url) return
            onPick(selection)
            dialogRef.current?.close()
          }}
        />
      </div>
    </dialog>
  )
}

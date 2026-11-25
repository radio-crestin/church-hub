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
      className="m-auto w-[min(40rem,95vw)] rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          {kind === 'image'
            ? t('deckEditor.choosePicture')
            : t('deckEditor.chooseVideo')}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={t('common:buttons.done')}
        >
          <X size={18} />
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

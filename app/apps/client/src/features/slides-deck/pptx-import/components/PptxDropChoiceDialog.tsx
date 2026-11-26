import { FileText, Presentation } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { PptxDropChoice } from '../hooks/usePptxDropChoice'

/**
 * Asks what a .pptx dropped on a presentation's page becomes: slides of this
 * presentation, or a song (what a drop does everywhere else).
 */
export function PptxDropChoiceDialog({ choice }: { choice: PptxDropChoice }) {
  const { t } = useTranslation('schedules')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const open = !!choice.pending

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const button =
    'flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800'
  return (
    <>
      <span hidden data-testid="pptx-drop-target" data-ready={choice.ready} />
      <dialog
        ref={dialogRef}
        data-testid="pptx-drop-choice"
        onCancel={(event) => {
          event.preventDefault()
          choice.cancel()
        }}
        className="m-auto w-[min(26rem,95vw)] rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50 dark:bg-gray-900"
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {t('slidesImport.dropTitle')}
            </h2>
            <p className="mt-1 break-all text-sm text-gray-500 dark:text-gray-400">
              {choice.pending?.file.name}
            </p>
          </div>
          <button
            type="button"
            data-testid="pptx-drop-as-slides"
            onClick={choice.asSlides}
            className={button}
          >
            <Presentation size={18} className="shrink-0 text-amber-600" />
            {t('slidesImport.asSlides')}
          </button>
          <button
            type="button"
            data-testid="pptx-drop-as-song"
            onClick={choice.asSong}
            className={button}
          >
            <FileText size={18} className="shrink-0 text-indigo-600" />
            {t('slidesImport.asSong')}
          </button>
          <div className="flex justify-end">
            <button
              type="button"
              data-testid="pptx-drop-cancel"
              onClick={choice.cancel}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('slidesImport.cancel')}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}

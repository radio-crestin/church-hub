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
    'flex w-full items-center gap-3 rounded-lg border border-line px-4 py-3 text-left text-[13px] font-medium text-fg hover:bg-hover'
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
        className="m-auto w-[min(26rem,95vw)] rounded-xl border border-line bg-panel p-0 shadow-popover backdrop:bg-black/50"
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-fg">
              {t('slidesImport.dropTitle')}
            </h2>
            <p className="mt-1 break-all text-xs text-fg-hint">
              {choice.pending?.file.name}
            </p>
          </div>
          <button
            type="button"
            data-testid="pptx-drop-as-slides"
            onClick={choice.asSlides}
            className={button}
          >
            <Presentation
              size={16}
              strokeWidth={1.5}
              className="shrink-0 text-fg-label"
            />
            {t('slidesImport.asSlides')}
          </button>
          <button
            type="button"
            data-testid="pptx-drop-as-song"
            onClick={choice.asSong}
            className={button}
          >
            <FileText
              size={16}
              strokeWidth={1.5}
              className="shrink-0 text-fg-label"
            />
            {t('slidesImport.asSong')}
          </button>
          <div className="flex justify-end">
            <button
              type="button"
              data-testid="pptx-drop-cancel"
              onClick={choice.cancel}
              className="h-9 rounded-lg bg-field px-4 text-[13px] font-medium text-fg hover:bg-hover"
            >
              {t('slidesImport.cancel')}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}

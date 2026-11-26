import { Loader2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PptxImportSummary } from './PptxImportSummary'
import type { PptxImport } from '../hooks/usePptxImport'

const PPTX_ACCEPT =
  '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation'

/**
 * A PowerPoint import on screen: the file chooser (opened by `choose`), then
 * a dialog with its progress (reading, uploading N pictures and videos,
 * saving) and, once done, its summary.
 */
export function PptxImportDialog({ pptx }: { pptx: PptxImport }) {
  const { t } = useTranslation('schedules')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { state } = pptx
  const open = state.status !== 'idle'
  const working = state.status === 'working'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const progress = state.status === 'working' ? state.progress : null
  return (
    <>
      <input
        ref={pptx.inputRef}
        type="file"
        accept={PPTX_ACCEPT}
        data-testid="pptx-import-input"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void pptx.run(file)
        }}
      />
      <dialog
        ref={dialogRef}
        data-testid="pptx-import-dialog"
        data-status={state.status}
        onCancel={(event) => {
          event.preventDefault()
          if (!working) pptx.close()
        }}
        className="m-auto w-[min(36rem,95vw)] rounded-xl border border-line bg-panel p-0 shadow-popover backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-fg">
            {t('slidesImport.title')}
          </h2>
          <button
            type="button"
            data-testid="pptx-import-close"
            onClick={pptx.close}
            disabled={working}
            aria-label={t('slidesImport.close')}
            className="rounded-lg p-1.5 text-fg-label hover:bg-hover hover:text-fg disabled:opacity-40"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4">
          {progress && (
            <div
              data-testid="pptx-import-progress"
              data-phase={progress.phase}
              className="space-y-3"
            >
              <p className="flex items-center gap-2 text-[13px] text-fg-body tabular-nums">
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                {progress.phase === 'uploading'
                  ? t('slidesImport.uploading', {
                      done: progress.done,
                      total: progress.total,
                    })
                  : t(`slidesImport.${progress.phase}`)}
              </p>
              {progress.phase === 'uploading' && progress.total > 0 && (
                <div className="h-2 overflow-hidden rounded bg-field">
                  <div
                    className="h-full bg-primary transition-[width]"
                    style={{
                      width: `${(progress.done / progress.total) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {state.status === 'done' && (
            <PptxImportSummary result={state.result} />
          )}
          {state.status === 'error' && (
            <p
              data-testid="pptx-import-error"
              className="text-[13px] text-red-600 dark:text-red-400"
            >
              {t(
                state.failed === 'read'
                  ? 'slidesImport.readFailed'
                  : 'slidesImport.saveFailed',
              )}
            </p>
          )}
        </div>
        {!working && (
          <div className="flex justify-end border-t border-line px-4 py-3">
            <button
              type="button"
              data-testid="pptx-import-done"
              onClick={pptx.close}
              className="h-9 rounded-lg bg-primary px-4 text-[13px] font-medium text-white hover:bg-indigo-700"
            >
              {t('slidesImport.close')}
            </button>
          </div>
        )}
      </dialog>
    </>
  )
}

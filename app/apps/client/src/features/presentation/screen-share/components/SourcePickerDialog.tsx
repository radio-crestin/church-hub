import { AppWindow, Loader2, Monitor, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { createLogger } from '~/utils/logger'
import {
  type CaptureSource,
  listCaptureSources,
} from '../service/nativeCapture'

const logger = createLogger('app:screen-share:picker')

interface SourcePickerDialogProps {
  isOpen: boolean
  onClose: () => void
  onPick: (sourceId: string) => void
}

/** The desktop app's picker: every screen and window, with a live thumbnail. */
export function SourcePickerDialog({
  isOpen,
  onClose,
  onPick,
}: SourcePickerDialogProps) {
  const { t } = useTranslation(['presentation', 'common'])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [sources, setSources] = useState<CaptureSource[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setSources(null)
    setFailed(false)
    try {
      setSources(await listCaptureSources())
    } catch (error) {
      logger.error('Could not list capture sources', error)
      setFailed(true)
      setSources([])
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      dialog.showModal()
      void load()
    } else {
      dialog.close()
    }
  }, [isOpen, load])

  const screens = sources?.filter((s) => s.kind === 'monitor') ?? []
  const windows = sources?.filter((s) => s.kind === 'window') ?? []
  const noPreviews = !!sources?.length && sources.every((s) => !s.thumbnail)

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="screen-share-picker-title"
      className="fixed inset-0 m-auto p-0 rounded-xl border border-line shadow-popover backdrop:bg-black/50 bg-panel w-[min(56rem,calc(100vw-1rem))] max-h-[calc(100vh-2rem)]"
      onClose={onClose}
    >
      <div className="flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="flex items-center justify-between gap-2 p-4 border-b border-line">
          <h2
            id="screen-share-picker-title"
            className="text-base font-semibold text-fg"
          >
            {t('presentation:controlRoom.screenShare.picker.title')}
          </h2>
          <Button
            variant="ghost"
            onClick={() => void load()}
            disabled={sources === null}
            className="gap-2"
          >
            <RefreshCw size={16} strokeWidth={1.5} />
            <span className="hidden sm:inline">
              {t('presentation:controlRoom.screenShare.picker.refresh')}
            </span>
          </Button>
        </div>

        <div className="overflow-y-auto p-4 flex flex-col gap-6">
          {sources === null ? (
            <div className="flex items-center justify-center gap-2 py-12 text-fg-hint">
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              {t('presentation:controlRoom.screenShare.picker.loading')}
            </div>
          ) : sources.length === 0 ? (
            <p className="py-12 text-center text-fg-hint">
              {t(
                failed
                  ? 'presentation:controlRoom.screenShare.picker.error'
                  : 'presentation:controlRoom.screenShare.picker.empty',
              )}
            </p>
          ) : (
            <>
              {noPreviews && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {t(
                    'presentation:controlRoom.screenShare.picker.permissionHint',
                  )}
                </p>
              )}
              <SourceGroup
                title={t('presentation:controlRoom.screenShare.picker.screens')}
                sources={screens}
                onPick={onPick}
              />
              <SourceGroup
                title={t('presentation:controlRoom.screenShare.picker.windows')}
                sources={windows}
                onPick={onPick}
              />
            </>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-line">
          <Button variant="secondary" onClick={onClose}>
            {t('common:buttons.cancel')}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

function SourceGroup({
  title,
  sources,
  onPick,
}: {
  title: string
  sources: CaptureSource[]
  onPick: (sourceId: string) => void
}) {
  const { t } = useTranslation('presentation')
  if (sources.length === 0) return null
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-fg-label">{title}</h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {sources.map((source) => (
          <li key={source.id}>
            <button
              type="button"
              onClick={() => onPick(source.id)}
              data-source-id={source.id}
              className="w-full text-left rounded-lg border border-line hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus overflow-hidden bg-field"
            >
              <div className="aspect-video bg-black flex items-center justify-center">
                {source.thumbnail ? (
                  <img
                    src={source.thumbnail}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-white/60">
                    {t('controlRoom.screenShare.picker.noPreview')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 p-2 min-w-0">
                {source.kind === 'monitor' ? (
                  <Monitor
                    size={16}
                    strokeWidth={1.5}
                    className="shrink-0 text-fg-label"
                  />
                ) : (
                  <AppWindow
                    size={16}
                    strokeWidth={1.5}
                    className="shrink-0 text-fg-label"
                  />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg">
                    {source.name}
                  </div>
                  <div className="truncate text-xs text-fg-hint">
                    {source.appName ?? `${source.width}×${source.height}`}
                  </div>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

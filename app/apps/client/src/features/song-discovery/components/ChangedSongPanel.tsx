import { Check, Download } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { LyricsDiffView } from './LyricsDiffView'
import type { ChangedItem } from '../hooks/useChangedSelection'
import { slidesToLines } from '../utils/lyricsDiff'

interface ChangedSongPanelProps {
  item: ChangedItem
  sourceName: string
  onUpdate: () => void
  onKeep: () => void
  isResolving: boolean
}

/**
 * A library song the source changed: its lyrics in the library against the
 * source's, and the choice to update it or keep the library's.
 */
export function ChangedSongPanel({
  item,
  sourceName,
  onUpdate,
  onKeep,
  isResolving,
}: ChangedSongPanelProps) {
  const { t } = useTranslation('songDiscovery')
  const ref = useRef<HTMLDivElement>(null)
  // On a phone the panel sits under the list: bring it into view.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' })
  }, [item.key])
  const libraryLines = useMemo(
    () => slidesToLines(item.library.slides.map((content) => ({ content }))),
    [item.library.slides],
  )
  const sourceLines = useMemo(
    () =>
      slidesToLines(
        item.song.parsed.slides.map((slide) => ({
          content: slide.htmlContent,
        })),
      ),
    [item.song.parsed.slides],
  )

  return (
    <div
      ref={ref}
      className="space-y-3 rounded-xl border border-line bg-panel p-4"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-fg">
            {item.library.title}
          </h2>
          <p className="text-sm text-fg-hint">
            {t('changed.subtitle', { source: sourceName })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={onUpdate}
            disabled={isResolving}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {t('changed.update')}
          </Button>
          <Button
            variant="secondary"
            onClick={onKeep}
            disabled={isResolving}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            {t('changed.keep')}
          </Button>
        </div>
      </div>
      <LyricsDiffView
        libraryLines={libraryLines}
        candidateLines={sourceLines}
      />
      <p className="text-xs text-fg-hint">{t('changed.editedNeverHere')}</p>
    </div>
  )
}

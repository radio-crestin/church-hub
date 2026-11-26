import { useTranslation } from 'react-i18next'

import type { PptxImportResult } from '../types'
import { noteMessageKey } from '../utils/noteMessageKey'

const OUTCOME_CLASS = {
  picture: 'bg-field text-fg-label',
  skipped: 'bg-field text-red-600 dark:text-red-400',
  changed: 'bg-field text-amber-700 dark:text-amber-300',
}

/**
 * What an import brought in (slides, pictures, videos) and, slide by slide,
 * what differs from PowerPoint: shown as a picture, left out or changed, and
 * why.
 */
export function PptxImportSummary({ result }: { result: PptxImportResult }) {
  const { t } = useTranslation('schedules')
  const notes = [...result.notes].sort(
    (a, b) => (a.slide ?? 0) - (b.slide ?? 0),
  )
  return (
    <div data-testid="pptx-import-summary" className="space-y-3">
      <p className="text-[13px] font-medium text-fg">
        {t('slidesImport.imported', { count: result.deck.slides.length })}
      </p>
      <p className="text-[13px] text-fg-label tabular-nums">
        {t('slidesImport.pictures', { count: result.pictures })} ·{' '}
        {t('slidesImport.videos', { count: result.videos })}
      </p>
      {notes.length === 0 ? (
        <p className="text-[13px] text-fg-body">
          {t('slidesImport.allImported')}
        </p>
      ) : (
        <>
          <h3 className="text-[13px] font-semibold text-fg">
            {t('slidesImport.differences')}
          </h3>
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto text-[13px]">
            {notes.map((note, index) => (
              <li
                // Notes have no id; their order is fixed for the dialog's life.
                key={index}
                data-testid="pptx-import-note"
                data-slide={note.slide ?? ''}
                data-reason={note.reason}
                data-outcome={note.outcome}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
              >
                <span className="text-xs font-medium text-fg-hint tabular-nums">
                  {note.slide
                    ? t('slidesImport.slide', { number: note.slide })
                    : t('slidesImport.wholeFile')}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${OUTCOME_CLASS[note.outcome]}`}
                >
                  {t(`slidesImport.outcomes.${note.outcome}`)}
                </span>
                <span className="min-w-0 text-fg-body">
                  {t(`slidesImport.reasons.${noteMessageKey(note)}`, {
                    name: note.detail,
                    count: note.count,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

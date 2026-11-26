import { useTranslation } from 'react-i18next'

import type { PptxImportResult } from '../types'
import { noteMessageKey } from '../utils/noteMessageKey'

const OUTCOME_CLASS = {
  picture: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  skipped: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  changed:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
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
      <p className="font-medium text-gray-900 dark:text-white">
        {t('slidesImport.imported', { count: result.deck.slides.length })}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {t('slidesImport.pictures', { count: result.pictures })} ·{' '}
        {t('slidesImport.videos', { count: result.videos })}
      </p>
      {notes.length === 0 ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t('slidesImport.allImported')}
        </p>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('slidesImport.differences')}
          </h3>
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto text-sm">
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
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {note.slide
                    ? t('slidesImport.slide', { number: note.slide })
                    : t('slidesImport.wholeFile')}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${OUTCOME_CLASS[note.outcome]}`}
                >
                  {t(`slidesImport.outcomes.${note.outcome}`)}
                </span>
                <span className="min-w-0 text-gray-800 dark:text-gray-200">
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

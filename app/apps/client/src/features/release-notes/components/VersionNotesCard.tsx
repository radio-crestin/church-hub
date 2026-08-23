import { Bug, Sparkles, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ChangeCategoryList } from './ChangeCategoryList'
import type { VersionNotes } from '../types'

/**
 * How the card is framed: a past version, the one running now, or one that is
 * waiting to be installed. Same layout in all three so an update reads exactly
 * like the history below it.
 */
export type VersionNotesVariant = 'default' | 'current' | 'available'

interface VersionNotesCardProps {
  notes: VersionNotes
  variant?: VersionNotesVariant
  /** Rendered under the notes, separated by a rule — actions, progress, etc. */
  children?: ReactNode
  'data-testid'?: string
}

const FRAME: Record<VersionNotesVariant, string> = {
  default:
    'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50',
  current:
    'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10',
  available:
    'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10',
}

const RULE: Record<VersionNotesVariant, string> = {
  default: 'border-gray-200 dark:border-gray-700',
  current: 'border-indigo-200 dark:border-indigo-800',
  available: 'border-green-200 dark:border-green-800',
}

function formatDate(date: string | null, language: string): string {
  if (!date) return ''
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function VersionNotesCard({
  notes,
  variant = 'default',
  children,
  'data-testid': testId,
}: VersionNotesCardProps) {
  const { t, i18n } = useTranslation('releaseNotes')

  const isEmpty =
    notes.features.length + notes.bugFixes.length + notes.changes.length === 0
  const formattedDate = formatDate(notes.date, i18n.language)

  return (
    <div
      className={`p-4 rounded-lg border ${FRAME[variant]}`}
      data-testid={testId}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-base font-bold text-gray-900 dark:text-white">
          v{notes.version}
        </span>
        {variant === 'current' && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-600 text-white">
            {t('current')}
          </span>
        )}
        {variant === 'available' && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-600 text-white">
            {t('available')}
          </span>
        )}
        {formattedDate && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formattedDate}
          </span>
        )}
      </div>

      {isEmpty ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          {t('empty')}
        </p>
      ) : (
        <div className="space-y-3">
          <ChangeCategoryList
            icon={Sparkles}
            label={t('categories.features')}
            accentClassName="text-green-600 dark:text-green-400"
            entries={notes.features}
          />
          <ChangeCategoryList
            icon={Bug}
            label={t('categories.bugFixes')}
            accentClassName="text-red-600 dark:text-red-400"
            entries={notes.bugFixes}
          />
          <ChangeCategoryList
            icon={Wrench}
            label={t('categories.changes')}
            accentClassName="text-amber-600 dark:text-amber-400"
            entries={notes.changes}
          />
        </div>
      )}

      {children && (
        <div className={`mt-4 border-t pt-4 ${RULE[variant]}`}>{children}</div>
      )}
    </div>
  )
}

import { Bug, Sparkles, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ChangeCategoryList } from './ChangeCategoryList'
import type { VersionNotes } from '../types'

interface VersionNotesCardProps {
  notes: VersionNotes
  isCurrent: boolean
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

export function VersionNotesCard({ notes, isCurrent }: VersionNotesCardProps) {
  const { t, i18n } = useTranslation('releaseNotes')

  const isEmpty =
    notes.features.length + notes.bugFixes.length + notes.changes.length === 0
  const formattedDate = formatDate(notes.date, i18n.language)

  return (
    <div
      className={`p-4 rounded-lg border ${
        isCurrent
          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10'
          : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-base font-bold text-gray-900 dark:text-white">
          v{notes.version}
        </span>
        {isCurrent && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-600 text-white">
            {t('current')}
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
    </div>
  )
}

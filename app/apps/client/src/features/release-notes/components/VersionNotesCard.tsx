import { Bug, Sparkles, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ChangeCategoryList } from './ChangeCategoryList'
import type { ChangeEntry, VersionNotes } from '../types'

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
  default: 'border-line',
  current: 'border-line-strong',
  available: 'border-line-strong',
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

function toEntry(message: string): ChangeEntry {
  return { scope: null, message }
}

/**
 * What the card lists: the written notes in the app's language when the
 * version has them, else its commits.
 */
function listedChanges(notes: VersionNotes, language: string) {
  const written = notes.written?.[language.startsWith('ro') ? 'ro' : 'en']
  if (!written) return notes
  return {
    features: written.features.map(toEntry),
    bugFixes: written.bugFixes.map(toEntry),
    changes: [],
  }
}

export function VersionNotesCard({
  notes,
  variant = 'default',
  children,
  'data-testid': testId,
}: VersionNotesCardProps) {
  const { t, i18n } = useTranslation('releaseNotes')

  const { features, bugFixes, changes } = listedChanges(notes, i18n.language)
  const isEmpty = features.length + bugFixes.length + changes.length === 0
  const formattedDate = formatDate(notes.date, i18n.language)

  return (
    <div
      className={`p-4 rounded-xl border ${FRAME[variant]}`}
      data-testid={testId}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[15px] font-semibold tabular-nums text-fg">
          v{notes.version}
        </span>
        {variant === 'current' && (
          <span className="text-xs font-medium text-fg-label">
            {t('current')}
          </span>
        )}
        {variant === 'available' && (
          <span className="text-xs font-medium text-fg-label">
            {t('available')}
          </span>
        )}
        {formattedDate && (
          <span className="text-xs text-fg-hint">{formattedDate}</span>
        )}
      </div>

      {isEmpty ? (
        <p className="text-[13px] text-fg-hint italic">{t('empty')}</p>
      ) : (
        <div className="space-y-3">
          <ChangeCategoryList
            icon={Sparkles}
            label={t('categories.features')}
            entries={features}
          />
          <ChangeCategoryList
            icon={Bug}
            label={t('categories.bugFixes')}
            entries={bugFixes}
          />
          <ChangeCategoryList
            icon={Wrench}
            label={t('categories.changes')}
            entries={changes}
          />
        </div>
      )}

      {children && (
        <div className="mt-4 border-t border-line pt-4">{children}</div>
      )}
    </div>
  )
}

import { ChevronDown, ChevronUp, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { VersionNotesCard } from './VersionNotesCard'
import { useReleaseNotes } from '../hooks'

const DEFAULT_VISIBLE = 5

interface ReleaseNotesSectionProps {
  /** The running app version, highlighted in the list (without leading "v"). */
  currentVersion?: string
}

export function ReleaseNotesSection({
  currentVersion,
}: ReleaseNotesSectionProps) {
  const { t } = useTranslation('releaseNotes')
  const { data: versions } = useReleaseNotes()
  const [expanded, setExpanded] = useState(false)

  if (!versions || versions.length === 0) return null

  const visible = expanded ? versions : versions.slice(0, DEFAULT_VISIBLE)
  const hasMore = versions.length > DEFAULT_VISIBLE
  const normalizedCurrent = currentVersion?.replace(/^v/, '')

  return (
    <div
      data-testid="release-notes-section"
      className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800"
    >
      <div className="flex items-center gap-2 mb-4">
        <ScrollText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('title')}
        </h3>
      </div>

      <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
        {t('description')}
      </p>

      <div className="space-y-3">
        {visible.map((notes) => (
          <VersionNotesCard
            key={notes.version}
            notes={notes}
            variant={
              notes.version === normalizedCurrent ? 'current' : 'default'
            }
          />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp size={16} />
              {t('showLess')}
            </>
          ) : (
            <>
              <ChevronDown size={16} />
              {t('showAll', { count: versions.length })}
            </>
          )}
        </button>
      )}
    </div>
  )
}

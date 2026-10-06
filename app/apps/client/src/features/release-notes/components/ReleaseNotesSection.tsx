import { ChevronDown, ChevronUp, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { VersionNotesCard } from './VersionNotesCard'
import { SettingsSection } from '../../settings'
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
    <SettingsSection
      testId="release-notes-section"
      title={t('title')}
      description={t('description')}
      icon={ScrollText}
    >
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
    </SettingsSection>
  )
}

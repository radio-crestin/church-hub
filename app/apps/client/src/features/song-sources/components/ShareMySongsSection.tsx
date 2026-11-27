import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { secondaryButton } from './buttonStyles'
import { SectionHeading } from './SectionHeading'
import { ShareForm } from './ShareForm'
import { ShareStatus } from './ShareStatus'
import { useLibraryShares } from '../hooks/useLibraryShares'

/**
 * "Share my songs": groups of songs (the whole library, or categories and
 * songs picked), each published with its own link through Church Hub's
 * cloud sync (no S3 keys needed), unlisted by default or listed in the
 * public catalog.
 */
export function ShareMySongsSection() {
  const { t } = useTranslation('songDiscovery')
  const { data } = useLibraryShares()
  /** The share being changed, 'new' for a new one, null while none is. */
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const shares = data?.shares ?? []

  return (
    <section className="space-y-3" data-testid="share-my-songs">
      <SectionHeading
        title={t('songSources.share.title')}
        description={t('songSources.share.description')}
      />
      {data && !data.cloudSync ? (
        <p className="text-sm text-fg-hint">
          {t('songSources.share.needsCloudSync')}
        </p>
      ) : (
        <div className="space-y-3">
          {shares.length === 0 && editing !== 'new' && (
            <p className="text-sm text-fg-hint">
              {t('songSources.share.empty')}
            </p>
          )}
          {shares.map((share) =>
            editing === share.id ? (
              <ShareForm
                key={share.id}
                share={share}
                onDone={() => setEditing(null)}
              />
            ) : (
              <ShareStatus
                key={share.id}
                share={share}
                onEdit={() => setEditing(share.id)}
              />
            ),
          )}
          {editing === 'new' ? (
            <ShareForm onDone={() => setEditing(null)} />
          ) : (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className={secondaryButton}
            >
              <Plus className="h-4 w-4" />
              {t('songSources.share.newShare')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

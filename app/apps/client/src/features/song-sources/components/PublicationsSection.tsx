import { Loader2, Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { primaryButton } from './buttonStyles'
import { CategorySelect } from './CategorySelect'
import { PublicationRow } from './PublicationRow'
import { SectionHeading } from './SectionHeading'
import { usePublications, usePublishCategory } from '../hooks/usePublications'
import { useS3Storage } from '../hooks/useS3Storage'

/** Categories shared through the user's S3 bucket, each with its link. */
export function PublicationsSection() {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const { data: storage } = useS3Storage()
  const { data: publications = [] } = usePublications()
  const publish = usePublishCategory()
  const [categoryId, setCategoryId] = useState<number | null>(null)

  const handlePublish = async () => {
    if (categoryId == null) return
    try {
      await publish.mutateAsync(categoryId)
      setCategoryId(null)
    } catch (error) {
      showToast(
        t('songSources.publish.failed', { error: (error as Error).message }),
        'error',
      )
    }
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        title={t('songSources.publish.title')}
        description={t('songSources.publish.description')}
      />
      {!storage ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('songSources.publish.needsStorage')}
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <CategorySelect
            id="song-source-publish-category"
            value={categoryId}
            onChange={setCategoryId}
            placeholder={t('songSources.publish.category')}
          />
          <button
            type="button"
            onClick={handlePublish}
            disabled={categoryId == null || publish.isPending}
            className={primaryButton}
          >
            {publish.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {t('songSources.publish.button')}
          </button>
        </div>
      )}
      {publications.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('songSources.publish.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
          {publications.map((publication) => (
            <PublicationRow key={publication.id} publication={publication} />
          ))}
        </ul>
      )}
    </section>
  )
}

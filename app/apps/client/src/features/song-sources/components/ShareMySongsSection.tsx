import { Loader2, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { primaryButton } from './buttonStyles'
import { SectionHeading } from './SectionHeading'
import { ShareScopePicker } from './ShareScopePicker'
import { ShareStatus } from './ShareStatus'
import { useLibraryShare, useSaveLibraryShare } from '../hooks/useLibraryShare'

/**
 * "Share my songs": the whole library or chosen categories, published
 * through Church Hub's cloud sync (no S3 keys needed), unlisted (link
 * only) by default or listed in the public catalog.
 */
export function ShareMySongsSection() {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const { data } = useLibraryShare()
  const save = useSaveLibraryShare()
  const share = data?.share ?? null
  const [name, setName] = useState('')
  const [categoryIds, setCategoryIds] = useState<number[] | null>(null)
  const [listed, setListed] = useState(false)

  useEffect(() => {
    if (!share) return
    setName(share.name)
    setCategoryIds(share.categoryIds)
    setListed(share.listed)
  }, [share])

  const handleSave = async () => {
    try {
      await save.mutateAsync({ name, categoryIds, listed })
    } catch (error) {
      showToast(
        t('songSources.share.failed', { error: (error as Error).message }),
        'error',
      )
    }
  }

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
          <label className="block space-y-1">
            <span className="text-sm text-fg-label">
              {t('songSources.share.name')}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('songSources.share.namePlaceholder')}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-fg focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus sm:w-80"
            />
          </label>
          <ShareScopePicker
            categoryIds={categoryIds}
            onChange={setCategoryIds}
          />
          <label className="flex items-start gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={listed}
              onChange={(e) => setListed(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              {t('songSources.share.listed')}
              <span className="block text-xs text-fg-hint">
                {t('songSources.share.listedHint')}
              </span>
            </span>
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={save.isPending || categoryIds?.length === 0}
            className={primaryButton}
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {share
              ? t('songSources.share.update')
              : t('songSources.share.button')}
          </button>
          {share && <ShareStatus share={share} />}
        </div>
      )}
    </section>
  )
}

import { Loader2, Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SongSelection } from '~/features/songs/components/SongSelectionPicker'
import { useToast } from '~/ui/toast'
import { primaryButton, secondaryButton } from './buttonStyles'
import { ShareScopePicker } from './ShareScopePicker'
import { useSaveLibraryShare } from '../hooks/useLibraryShares'
import type { LibraryShare } from '../types'

interface ShareFormProps {
  /** The share to change; a new one when absent. */
  share?: LibraryShare
  onDone: () => void
}

/** A share's name, contents (whole library, or songs picked) and listing. */
export function ShareForm({ share, onDone }: ShareFormProps) {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const save = useSaveLibraryShare()
  const [name, setName] = useState(share?.name ?? '')
  const [selection, setSelection] = useState<SongSelection | null>(
    share?.categoryIds
      ? { categoryIds: share.categoryIds, songs: share.songs }
      : share
        ? null
        : { categoryIds: [], songs: [] },
  )
  const [listed, setListed] = useState(share?.listed ?? false)
  const empty =
    selection !== null &&
    selection.categoryIds.length === 0 &&
    selection.songs.length === 0

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        id: share?.id,
        name,
        categoryIds: selection?.categoryIds ?? null,
        songIds: selection?.songs.map((song) => song.id) ?? [],
        listed,
      })
      onDone()
    } catch (error) {
      showToast(
        t('songSources.share.failed', { error: (error as Error).message }),
        'error',
      )
    }
  }

  return (
    <div
      className="space-y-3 rounded-lg border border-line bg-panel px-3 py-3"
      data-testid="share-form"
    >
      <label className="block space-y-1">
        <span className="block text-sm text-fg-label">
          {t('songSources.share.name')}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('songSources.share.namePlaceholder')}
          className="w-full rounded-lg border border-line bg-field px-3 py-2 text-base text-fg focus:outline-none focus:ring-2 focus:ring-focus sm:w-80 md:text-sm"
        />
      </label>
      <ShareScopePicker value={selection} onChange={setSelection} />
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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={save.isPending || empty}
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
        <button type="button" onClick={onDone} className={secondaryButton}>
          {t('songSources.share.cancel')}
        </button>
      </div>
    </div>
  )
}

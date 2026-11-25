import { Check, Film } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BackgroundMediaThumbnail } from '~/features/background-media/components/BackgroundMediaThumbnail'
import { useBackgroundMediaList } from '~/features/background-media/hooks/useBackgroundMediaList'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { ItemDialog } from './ItemDialog'
import { SourceTabs } from './SourceTabs'
import type { VideoItemConfig } from './types'

interface VideoItemDialogProps {
  initial?: VideoItemConfig | null
  isSaving: boolean
  onSave: (config: VideoItemConfig) => void
  onClose: () => void
}

/**
 * A video item's settings: a video of the gallery, or a random one, shown
 * full screen (once or looping) or looping behind the slides after it.
 */
export function VideoItemDialog({
  initial,
  isSaving,
  onSave,
  onClose,
}: VideoItemDialogProps) {
  const { t } = useTranslation('schedules')
  const [source, setSource] = useState(initial?.source ?? 'file')
  const [mediaId, setMediaId] = useState<string | null>(
    initial?.source === 'file' ? initial.mediaId : null,
  )
  const [loop, setLoop] = useState(initial?.loop ?? false)
  const [background, setBackground] = useState(initial?.background ?? false)
  const { data: media = [] } = useBackgroundMediaList()
  const videos = media.filter((m) => m.kind === 'video')

  const config: VideoItemConfig | null =
    source === 'random'
      ? { source, loop, background }
      : mediaId === null
        ? null
        : { source, mediaId, loop, background }

  return (
    <ItemDialog
      title={t('mediaItems.video.title')}
      icon={<Film size={20} className="text-sky-500" />}
      testId="video-item-dialog"
      canSave={config !== null}
      isSaving={isSaving}
      onSave={() => config && onSave(config)}
      onClose={onClose}
    >
      <SourceTabs
        testId="video-item-source"
        value={source}
        onChange={setSource}
        options={[
          { value: 'file', label: t('mediaItems.video.chosen') },
          { value: 'random', label: t('mediaItems.video.random') },
        ]}
      />
      {videos.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('mediaItems.video.noVideos')}
        </p>
      ) : source === 'random' ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('mediaItems.video.randomDescription', { count: videos.length })}
        </p>
      ) : (
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          role="radiogroup"
        >
          {videos.map((video) => (
            <button
              key={video.id}
              type="button"
              role="radio"
              aria-checked={video.id === mediaId}
              data-testid="video-item-option"
              onClick={() => setMediaId(video.id)}
              className={`relative aspect-video overflow-hidden rounded-lg border-2 bg-black ${
                video.id === mediaId
                  ? 'border-indigo-600'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <BackgroundMediaThumbnail media={video} />
              {video.id === mediaId && (
                <span className="absolute right-1 top-1 rounded-full bg-indigo-600 p-0.5 text-white">
                  <Check size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <SwitchRow
        label={t('mediaItems.video.background')}
        description={t('mediaItems.video.backgroundDescription')}
        checked={background}
        onCheckedChange={setBackground}
        testId="video-item-background"
      />
      {!background && (
        <SwitchRow
          label={t('mediaItems.video.loop')}
          description={t('mediaItems.video.loopDescription')}
          checked={loop}
          onCheckedChange={setLoop}
          testId="video-item-loop"
        />
      )}
    </ItemDialog>
  )
}

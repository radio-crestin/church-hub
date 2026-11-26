import { useTranslation } from 'react-i18next'

import { useBibleTopics } from '~/features/bible/topics'
import type { SlideDeck } from '~/features/slides-deck/types'
import { deckFirstText } from '~/features/slides-deck/utils/deckFirstText'
import type { ScheduleItem } from '../../types'
import type {
  MusicItemConfig,
  VersesItemConfig,
  VideoItemConfig,
} from '../types'

export interface MediaItemText {
  /** What the item is, as its row's first line reads. */
  title: string
  /** How it plays, as its row's second line reads. */
  detail: string
}

/**
 * How a music, video, verses, Slides or presentation item reads in a presentation's lists;
 * null for other items. One place, so the presentation page and the
 * Prezentări panel describe them the same way.
 */
export function useMediaItemText(item: ScheduleItem): MediaItemText | null {
  const { t, i18n } = useTranslation('schedules')
  const isTopic =
    item.itemType === 'verses' &&
    (item.itemConfig as VersesItemConfig | null)?.source === 'topic'
  const { data: topics = [] } = useBibleTopics({ enabled: isTopic })

  if (item.itemType === 'music') {
    const config = item.itemConfig as MusicItemConfig | null
    return {
      title: item.music?.folderName
        ? t('mediaItems.music.folderTitle', { name: item.music.folderName })
        : t('mediaItems.music.title'),
      detail: [
        t('mediaItems.music.trackCount', {
          count: item.music?.trackCount ?? 0,
        }),
        config?.shuffle
          ? t('mediaItems.music.shuffled')
          : t('mediaItems.music.inOrder'),
      ].join(' · '),
    }
  }

  if (item.itemType === 'video') {
    const config = item.itemConfig as VideoItemConfig | null
    return {
      title: t('mediaItems.video.title'),
      detail: [
        config?.source === 'random'
          ? t('mediaItems.video.random')
          : t('mediaItems.video.chosen'),
        config?.background
          ? t('mediaItems.video.asBackground')
          : config?.loop
            ? t('mediaItems.video.looping')
            : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }
  }

  if (item.itemType === 'slides') {
    const deck = item.itemConfig as SlideDeck | null
    return {
      title: deckFirstText(deck) || t('slidesDeck.title'),
      detail: t('slidesDeck.slideCount', { count: deck?.slides.length ?? 0 }),
    }
  }

  if (item.itemType === 'schedule') {
    return {
      title: item.childSchedule?.title ?? t('nested.missing'),
      detail: t('itemCount', { count: item.childSchedule?.items.length ?? 0 }),
    }
  }

  if (item.itemType === 'verses') {
    const config = item.itemConfig as VersesItemConfig | null
    const topic =
      config?.source === 'topic'
        ? topics.find((tp) => tp.key === config.topicKey)
        : undefined
    const source = topic
      ? i18n.language.startsWith('ro')
        ? topic.titleRo
        : topic.titleEn
      : (item.verseteTineriEntries[0]?.bookName ?? '')
    return {
      title: t('mediaItems.verses.rowTitle', { source }),
      detail: config?.count
        ? t('mediaItems.verses.randomCount', { count: config.count })
        : t('mediaItems.count.all'),
    }
  }

  return null
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { switchOBSScene } from '~/features/livestream/service'
import {
  useClearTemporaryContent,
  usePresentationState,
  usePresentTemporaryAnnouncement,
  usePresentTemporaryBiblePassage,
  usePresentTemporaryScene,
  usePresentTemporarySong,
  usePresentTemporaryVerseteTineri,
} from '~/features/presentation'
import { createLogger } from '~/utils/logger'
import { useSchedule } from './useSchedule'
import type { ScheduleItem } from '../types'
import { getNextScheduleItemPreview } from '../utils/nextScheduleItemPreview'
import {
  derivePresentedScheduleInfo,
  type PresentedScheduleInfo,
} from '../utils/presentedScheduleInfo'
import {
  buildItemStartFlatIndex,
  buildScheduleFlatItems,
  type ScheduleFlatItem,
} from '../utils/scheduleFlatItems'

const logger = createLogger('schedules:flat-navigation')

interface UseScheduleFlatNavigationOptions {
  /** The program being walked through. `null` disables everything. */
  scheduleId: number | null | undefined
  /**
   * Program items, when the caller already has them loaded. Omit and the hook
   * fetches the program itself (the query is shared, so this is cheap).
   */
  items?: ScheduleItem[]
  /**
   * Runs right before the content is sent to the projector, with the flat index
   * that is about to become live. The program page uses it to keep its URL's
   * `itemIndex` in step; other pages have nothing to sync.
   */
  onBeforeNavigate?: (flatIndex: number, flatItem: ScheduleFlatItem) => void
}

export interface ScheduleFlatNavigation {
  /** The program's items, in running order. */
  items: ScheduleItem[]
  /** Every presentable step of the program, in running order. */
  flatItems: ScheduleFlatItem[]
  /** Where each item starts in `flatItems`, keyed by item id. */
  itemStartFlatIndex: Record<number, number>
  /** What is on the projector right now, or `null`. */
  presentedInfo: PresentedScheduleInfo | null
  /** Whether the live content belongs to *this* program. */
  isScheduleLive: boolean
  /** Position of the live content in `flatItems`, or -1. */
  currentFlatIndex: number
  canNavigatePrev: boolean
  canNavigateNext: boolean
  isLoading: boolean
  getFlatItemIndex: (item: ScheduleItem, subIndex: number) => number
  presentSongSlide: (item: ScheduleItem, slideIndex: number) => Promise<void>
  presentPassageVerse: (item: ScheduleItem, verseIndex: number) => Promise<void>
  presentVerseteEntry: (item: ScheduleItem, entryIndex: number) => Promise<void>
  presentAnnouncement: (item: ScheduleItem) => Promise<void>
  presentScene: (item: ScheduleItem) => Promise<void>
  navigateToFlatItem: (
    flatItem: ScheduleFlatItem,
    flatIndex: number,
  ) => Promise<void>
  /** Presents the flat step at `flatIndex`, if it exists. */
  presentFlatIndex: (flatIndex: number) => Promise<void>
  goNext: () => Promise<void>
  goPrev: () => Promise<void>
}

/**
 * Walking a program from anywhere in the app.
 *
 * A program is a flat run of slides, verses, entries, announcements and OBS
 * scenes (see `buildScheduleFlatItems`). This hook owns that run: which step is
 * live, how to jump to a specific one, and how next/prev crosses from the last
 * slide of a song into the first verse of the passage that follows it.
 *
 * Every presented step carries `scheduleId` + `scheduleItemIndex`, which the
 * server echoes back — that echo is how the cursor survives a reload and how
 * every panel knows which row to paint green.
 */
export function useScheduleFlatNavigation({
  scheduleId,
  items: itemsOverride,
  onBeforeNavigate,
}: UseScheduleFlatNavigationOptions): ScheduleFlatNavigation {
  const queryClient = useQueryClient()
  const { data: presentationState } = usePresentationState()

  const presentTemporarySong = usePresentTemporarySong()
  const presentTemporaryBiblePassage = usePresentTemporaryBiblePassage()
  const presentTemporaryVerseteTineri = usePresentTemporaryVerseteTineri()
  const presentTemporaryAnnouncement = usePresentTemporaryAnnouncement()
  const presentTemporaryScene = usePresentTemporaryScene()
  const clearTemporary = useClearTemporaryContent()

  // A plain mutation rather than `useOBSScenes`, whose 30s poll has no place on
  // the song or Bible page — the scene list itself is never read here.
  const switchScene = useMutation({
    mutationFn: (sceneName: string) => switchOBSScene(sceneName),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['livestream', 'obs', 'scenes'],
      })
    },
  })

  const { data: schedule, isLoading } = useSchedule(
    itemsOverride ? undefined : (scheduleId ?? undefined),
  )

  const items = useMemo(
    () => itemsOverride ?? schedule?.items ?? [],
    [itemsOverride, schedule?.items],
  )

  const flatItems = useMemo(() => buildScheduleFlatItems(items), [items])
  const itemStartFlatIndex = useMemo(
    () => buildItemStartFlatIndex(items),
    [items],
  )

  const presentedInfo = useMemo(
    () => derivePresentedScheduleInfo(presentationState?.temporaryContent),
    [presentationState?.temporaryContent],
  )

  // Only claim the cursor when the live content actually came from this
  // program: a song presented straight from the song page carries no
  // scheduleId, and must not light up a row here.
  const isScheduleLive =
    !!presentedInfo &&
    !!scheduleId &&
    presentedInfo.scheduleId === scheduleId &&
    presentedInfo.scheduleItemIndex >= 0

  const currentFlatIndex = isScheduleLive
    ? (presentedInfo?.scheduleItemIndex ?? -1)
    : -1

  const canNavigatePrev = currentFlatIndex > 0
  // Next is still allowed on the last step: it hides the projection, which is
  // how a service ends.
  const isOnLastStep =
    currentFlatIndex >= 0 && currentFlatIndex === flatItems.length - 1
  const hasContent = !!presentationState?.temporaryContent
  const canNavigateNext =
    (currentFlatIndex >= 0 && currentFlatIndex < flatItems.length - 1) ||
    (isOnLastStep && hasContent)

  const getFlatItemIndex = useCallback(
    (item: ScheduleItem, subIndex: number): number =>
      flatItems.findIndex(
        (flat) => flat.item.id === item.id && flat.index === subIndex,
      ),
    [flatItems],
  )

  const presentSongSlide = useCallback(
    async (item: ScheduleItem, slideIndex: number) => {
      if (item.itemType !== 'song' || !item.songId) return

      const flatIndex = getFlatItemIndex(item, slideIndex)
      onBeforeNavigate?.(flatIndex, { item, type: 'slide', index: slideIndex })

      await presentTemporarySong.mutateAsync({
        songId: item.songId,
        slideIndex,
        nextItemPreview: getNextScheduleItemPreview(items, item),
        scheduleId: scheduleId ?? undefined,
        scheduleItemIndex: flatIndex,
      })
    },
    [
      getFlatItemIndex,
      items,
      onBeforeNavigate,
      presentTemporarySong,
      scheduleId,
    ],
  )

  const presentPassageVerse = useCallback(
    async (item: ScheduleItem, verseIndex: number) => {
      if (
        item.itemType !== 'bible_passage' ||
        !item.biblePassageVerses.length
      ) {
        return
      }

      // Reference format: "BookName Chapter:Verse" e.g. "Genesis 1:1".
      const parseReference = (ref: string) => {
        const match = ref.match(/(.+?)\s+(\d+):(\d+)/)
        if (match) {
          return {
            bookName: match[1],
            chapter: Number.parseInt(match[2], 10),
            verse: Number.parseInt(match[3], 10),
          }
        }
        return { bookName: '', chapter: 1, verse: 1 }
      }

      const firstVerse = item.biblePassageVerses[0]
      const lastVerse =
        item.biblePassageVerses[item.biblePassageVerses.length - 1]
      const parsedFirst = parseReference(firstVerse.reference)
      const parsedLast = parseReference(lastVerse.reference)

      const verses = item.biblePassageVerses.map((v) => ({
        verseId: v.verseId,
        verse: parseReference(v.reference).verse,
        text: v.text,
      }))

      const flatIndex = getFlatItemIndex(item, verseIndex)
      onBeforeNavigate?.(flatIndex, { item, type: 'verse', index: verseIndex })

      await presentTemporaryBiblePassage.mutateAsync({
        translationId: 0, // Not stored in the schedule, use 0
        translationAbbreviation: item.biblePassageTranslation || '',
        bookCode: '', // Not stored in the schedule
        bookName: parsedFirst.bookName,
        startChapter: parsedFirst.chapter,
        startVerse: parsedFirst.verse,
        endChapter: parsedLast.chapter,
        endVerse: parsedLast.verse,
        verses,
        currentVerseIndex: verseIndex,
        nextItemPreview: getNextScheduleItemPreview(items, item),
        scheduleId: scheduleId ?? undefined,
        scheduleItemIndex: flatIndex,
      })
    },
    [
      getFlatItemIndex,
      items,
      onBeforeNavigate,
      presentTemporaryBiblePassage,
      scheduleId,
    ],
  )

  const presentVerseteEntry = useCallback(
    async (item: ScheduleItem, entryIndex: number) => {
      if (
        item.itemType !== 'slide' ||
        item.slideType !== 'versete_tineri' ||
        !item.verseteTineriEntries.length
      ) {
        return
      }

      const entries = item.verseteTineriEntries.map((e) => ({
        id: e.id,
        personName: e.personName,
        reference: e.reference,
        bookCode: e.bookCode,
        bookName: e.bookName,
        startChapter: e.startChapter,
        startVerse: e.startVerse,
        endChapter: e.endChapter,
        endVerse: e.endVerse,
        text: e.text,
        sortOrder: e.sortOrder,
      }))

      const flatIndex = getFlatItemIndex(item, entryIndex)
      onBeforeNavigate?.(flatIndex, { item, type: 'entry', index: entryIndex })

      await presentTemporaryVerseteTineri.mutateAsync({
        entries,
        currentEntryIndex: entryIndex,
        nextItemPreview: getNextScheduleItemPreview(items, item),
        scheduleId: scheduleId ?? undefined,
        scheduleItemIndex: flatIndex,
      })
    },
    [
      getFlatItemIndex,
      items,
      onBeforeNavigate,
      presentTemporaryVerseteTineri,
      scheduleId,
    ],
  )

  const presentAnnouncement = useCallback(
    async (item: ScheduleItem) => {
      if (
        item.itemType !== 'slide' ||
        item.slideType !== 'announcement' ||
        !item.slideContent
      ) {
        return
      }

      const flatIndex = getFlatItemIndex(item, 0)
      onBeforeNavigate?.(flatIndex, { item, type: 'announcement', index: 0 })

      await presentTemporaryAnnouncement.mutateAsync({
        content: item.slideContent,
        nextItemPreview: getNextScheduleItemPreview(items, item),
        scheduleId: scheduleId ?? undefined,
        scheduleItemIndex: flatIndex,
      })
    },
    [
      getFlatItemIndex,
      items,
      onBeforeNavigate,
      presentTemporaryAnnouncement,
      scheduleId,
    ],
  )

  const presentScene = useCallback(
    async (item: ScheduleItem) => {
      if (
        item.itemType !== 'slide' ||
        item.slideType !== 'scene' ||
        !item.obsSceneName
      ) {
        return
      }

      const flatIndex = getFlatItemIndex(item, 0)
      onBeforeNavigate?.(flatIndex, { item, type: 'scene', index: 0 })

      try {
        await switchScene.mutateAsync(item.obsSceneName)
      } catch (error) {
        // OBS may not be connected; the empty slide still goes up.
        logger.warn('Failed to switch OBS scene:', error)
      }

      await presentTemporaryScene.mutateAsync({
        obsSceneName: item.obsSceneName,
        nextItemPreview: getNextScheduleItemPreview(items, item),
        scheduleId: scheduleId ?? undefined,
        scheduleItemIndex: flatIndex,
      })
    },
    [
      getFlatItemIndex,
      items,
      onBeforeNavigate,
      presentTemporaryScene,
      scheduleId,
      switchScene,
    ],
  )

  const navigateToFlatItem = useCallback(
    async (flatItem: ScheduleFlatItem, _flatIndex: number) => {
      const { item, type, index } = flatItem
      switch (type) {
        case 'slide':
          return presentSongSlide(item, index)
        case 'verse':
          return presentPassageVerse(item, index)
        case 'entry':
          return presentVerseteEntry(item, index)
        case 'announcement':
          return presentAnnouncement(item)
        case 'scene':
          return presentScene(item)
      }
    },
    [
      presentAnnouncement,
      presentPassageVerse,
      presentScene,
      presentSongSlide,
      presentVerseteEntry,
    ],
  )

  const presentFlatIndex = useCallback(
    async (flatIndex: number) => {
      const target = flatItems[flatIndex]
      if (!target) return
      await navigateToFlatItem(target, flatIndex)
    },
    [flatItems, navigateToFlatItem],
  )

  const goPrev = useCallback(async () => {
    if (currentFlatIndex <= 0) return
    await presentFlatIndex(currentFlatIndex - 1)
  }, [currentFlatIndex, presentFlatIndex])

  const goNext = useCallback(async () => {
    // Nothing live yet — start the program from the top.
    if (currentFlatIndex < 0) {
      await presentFlatIndex(0)
      return
    }

    // Past the last step there is nothing left to show; hide the projection.
    if (currentFlatIndex >= flatItems.length - 1) {
      if (presentationState?.temporaryContent) {
        await clearTemporary.mutateAsync()
      }
      return
    }

    await presentFlatIndex(currentFlatIndex + 1)
  }, [
    clearTemporary,
    currentFlatIndex,
    flatItems.length,
    presentFlatIndex,
    presentationState?.temporaryContent,
  ])

  return {
    items,
    flatItems,
    itemStartFlatIndex,
    presentedInfo,
    isScheduleLive,
    currentFlatIndex,
    canNavigatePrev,
    canNavigateNext,
    isLoading: itemsOverride ? false : isLoading,
    getFlatItemIndex,
    presentSongSlide,
    presentPassageVerse,
    presentVerseteEntry,
    presentAnnouncement,
    presentScene,
    navigateToFlatItem,
    presentFlatIndex,
    goNext,
    goPrev,
  }
}

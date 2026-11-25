import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { switchOBSScene } from '~/features/livestream/service'
import {
  type PresentationState,
  presentationStateQueryKey,
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
import {
  readProgramPosition,
  rememberProgramPosition,
} from '../service/lastProgramPosition'
import type { ScheduleItem } from '../types'
import { enqueueProgramNavigation } from '../utils/enqueueProgramNavigation'
import { liveScheduleFlatIndex } from '../utils/liveScheduleFlatIndex'
import { getNextScheduleItemPreview } from '../utils/nextScheduleItemPreview'
import {
  derivePresentedScheduleInfo,
  type PresentedScheduleInfo,
} from '../utils/presentedScheduleInfo'
import { programNavigationFlatIndex } from '../utils/programNavigationFlatIndex'
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
  /**
   * Whether this program's Prev/Next have a step to move to — from the live
   * step, or, with the program idle, from the step showing what is on screen
   * (see `programNavigationFlatIndex`).
   */
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
  /**
   * The item the operator picked in the list, waiting for the next Down/Up:
   * Down presents its first step, Up the step right before it. `null` once a
   * step has been presented.
   */
  selectedItemId: number | null
  selectItem: (item: ScheduleItem) => void
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

  // Fetched even with the items given: its loop setting is read below (the
  // query is shared, so this is cheap).
  const { data: schedule, isLoading } = useSchedule(scheduleId ?? undefined)
  const loop = schedule?.automation.loop ?? false

  const items = useMemo(
    () => itemsOverride ?? schedule?.items ?? [],
    [itemsOverride, schedule?.items],
  )

  const flatItems = useMemo(() => buildScheduleFlatItems(items), [items])
  const itemStartFlatIndex = useMemo(
    () => buildItemStartFlatIndex(items),
    [items],
  )

  // An item picked in the list is where the next Down/Up starts from, ahead
  // of whatever is on screen. The ref is what a queued press reads.
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const selectedItemIdRef = useRef<number | null>(null)
  const selectItem = useCallback((item: ScheduleItem) => {
    selectedItemIdRef.current = item.id
    setSelectedItemId(item.id)
  }, [])
  const clearSelection = useCallback(() => {
    selectedItemIdRef.current = null
    setSelectedItemId(null)
  }, [])
  // Every step that goes up, by any route, uses up the picked item.
  const beforeNavigate = useCallback(
    (flatIndex: number, flatItem: ScheduleFlatItem) => {
      clearSelection()
      onBeforeNavigate?.(flatIndex, flatItem)
    },
    [clearSelection, onBeforeNavigate],
  )

  const presentedInfo = useMemo(
    () => derivePresentedScheduleInfo(presentationState?.temporaryContent),
    [presentationState?.temporaryContent],
  )

  // Only claim the cursor when the live content actually came from this
  // program.
  const currentFlatIndex = liveScheduleFlatIndex(
    presentationState?.temporaryContent,
    scheduleId,
  )
  const isScheduleLive = currentFlatIndex >= 0

  // Kept for when the program goes idle: a song it holds twice, put up on its
  // own afterwards, is taken as the occurrence the program had reached.
  useEffect(() => {
    if (scheduleId && isScheduleLive) {
      rememberProgramPosition(scheduleId, currentFlatIndex)
    }
  }, [scheduleId, isScheduleLive, currentFlatIndex])

  // Where Next/Prev move from. Unlike the cursor above, a song or verse
  // presented on its own counts when the program holds it — without lighting a
  // row, since presenting it did not start the program.
  const navigationFlatIndex = programNavigationFlatIndex(
    presentationState?.temporaryContent,
    scheduleId,
    flatItems,
    readProgramPosition(scheduleId),
  )

  const selectedFlatIndex =
    selectedItemId === null
      ? null
      : (itemStartFlatIndex[selectedItemId] ?? null)

  const canNavigatePrev =
    selectedFlatIndex !== null ? selectedFlatIndex > 0 : navigationFlatIndex > 0
  // Next is still allowed on the last step: it hides the projection, which is
  // how a service ends.
  const isOnLastStep =
    navigationFlatIndex >= 0 && navigationFlatIndex === flatItems.length - 1
  const hasContent = !!presentationState?.temporaryContent
  const canNavigateNext =
    (selectedFlatIndex !== null && selectedFlatIndex < flatItems.length) ||
    (navigationFlatIndex >= 0 && navigationFlatIndex < flatItems.length - 1) ||
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
      beforeNavigate(flatIndex, { item, type: 'slide', index: slideIndex })

      await presentTemporarySong.mutateAsync({
        songId: item.songId,
        slideIndex,
        nextItemPreview: getNextScheduleItemPreview(items, item),
        scheduleId: scheduleId ?? undefined,
        scheduleItemIndex: flatIndex,
      })
    },
    [getFlatItemIndex, items, beforeNavigate, presentTemporarySong, scheduleId],
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
      beforeNavigate(flatIndex, { item, type: 'verse', index: verseIndex })

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
      beforeNavigate,
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
      beforeNavigate(flatIndex, { item, type: 'entry', index: entryIndex })

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
      beforeNavigate,
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
      beforeNavigate(flatIndex, { item, type: 'announcement', index: 0 })

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
      beforeNavigate,
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
      beforeNavigate(flatIndex, { item, type: 'scene', index: 0 })

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
      beforeNavigate,
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

  // Next/prev step from the program's position as it stands when their turn
  // comes, not when the key was pressed: presses still on their way would
  // otherwise all be applied to the same step (see enqueueProgramNavigation).
  // A song on screen that the program holds is that position too, and the step
  // presented from it makes the program live there.
  const readNavigationFlatIndex = useCallback(
    () =>
      programNavigationFlatIndex(
        queryClient.getQueryData<PresentationState>(presentationStateQueryKey)
          ?.temporaryContent,
        scheduleId,
        flatItems,
        readProgramPosition(scheduleId),
      ),
    [flatItems, queryClient, scheduleId],
  )

  // Where a picked item puts the next press: its first step, or -1 for none.
  const takeSelectedFlatIndex = useCallback((): number => {
    const id = selectedItemIdRef.current
    if (id === null) return -1
    clearSelection()
    return itemStartFlatIndex[id] ?? -1
  }, [clearSelection, itemStartFlatIndex])

  const goPrev = useCallback(
    () =>
      enqueueProgramNavigation(async () => {
        const selected = takeSelectedFlatIndex()
        if (selected >= 0) {
          await presentFlatIndex(selected - 1)
          return
        }
        const flatIndex = readNavigationFlatIndex()
        if (flatIndex <= 0) return
        await presentFlatIndex(flatIndex - 1)
      }),
    [readNavigationFlatIndex, presentFlatIndex, takeSelectedFlatIndex],
  )

  const goNext = useCallback(() => {
    // Whether this press starts the program: nothing of it is on the projector.
    const startsProgram = navigationFlatIndex < 0
    return enqueueProgramNavigation(async () => {
      const selected = takeSelectedFlatIndex()
      if (selected >= 0) {
        await presentFlatIndex(selected)
        return
      }
      const flatIndex = readNavigationFlatIndex()
      if (flatIndex < 0) {
        // Nothing of the program up yet — start it from the top. A press made
        // while the program ran finds it ended by the press before it, and
        // must not start it over.
        if (startsProgram) await presentFlatIndex(0)
        return
      }

      // Past the last step: start over when the presentation loops, else
      // there is nothing left to show; hide the projection.
      if (flatIndex >= flatItems.length - 1) {
        if (loop) await presentFlatIndex(0)
        else await clearTemporary.mutateAsync()
        return
      }

      await presentFlatIndex(flatIndex + 1)
    })
  }, [
    clearTemporary,
    flatItems.length,
    loop,
    navigationFlatIndex,
    presentFlatIndex,
    readNavigationFlatIndex,
    takeSelectedFlatIndex,
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
    selectedItemId,
    selectItem,
  }
}

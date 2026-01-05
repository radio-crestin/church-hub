import { useCallback, useState } from 'react'

import { replaceScheduleItems } from '../../schedules/service/schedules'
import type { ReplaceScheduleItemsInput } from '../../schedules/types'
import { searchSongs } from '../../songs/service/songs'
import type { ChurchProgramData, ExportedScheduleItem } from '../types'

export interface ImportResult {
  success: boolean
  itemCount?: number
  skippedSongs?: string[]
  skippedBiblePassages?: string[]
  error?: string
}

/**
 * Converts an exported item to a schedule input item
 */
async function convertItem(
  item: ExportedScheduleItem,
  skippedSongs: string[],
  skippedBiblePassages: string[],
): Promise<ReplaceScheduleItemsInput['items'][number] | null> {
  if (item.itemType === 'song' && item.song) {
    // Look up song by title
    const results = await searchSongs(item.song.title)
    const exactMatch = results.find(
      (s) => s.title.toLowerCase() === item.song!.title.toLowerCase(),
    )

    if (!exactMatch) {
      skippedSongs.push(item.song.title)
      return null
    }

    return {
      type: 'song',
      songId: exactMatch.id,
    }
  }

  if (item.itemType === 'bible_passage' && item.biblePassage) {
    // Bible passages require verse lookup which is complex
    // For now, skip them and notify the user
    skippedBiblePassages.push(item.biblePassage.reference)
    return null
  }

  if (item.itemType === 'slide') {
    // Handle versete_tineri slides with entries
    if (
      item.slideType === 'versete_tineri' &&
      item.verseteTineriEntries &&
      item.verseteTineriEntries.length > 0
    ) {
      return {
        type: 'slide',
        slideType: 'versete_tineri',
        verseteTineriEntries: item.verseteTineriEntries.map((entry) => ({
          personName: entry.personName,
          translationId: entry.translationId,
          bookCode: entry.bookCode,
          bookName: entry.bookName,
          startChapter: entry.startChapter,
          startVerse: entry.startVerse,
          endChapter: entry.endChapter,
          endVerse: entry.endVerse,
        })),
      }
    }

    // Regular slide (announcement)
    return {
      type: 'slide',
      slideType: item.slideType,
      slideContent: item.slideContent,
    }
  }

  return null
}

/**
 * Hook for importing schedule items from a parsed church program
 */
export function useImportScheduleItems() {
  const [isPending, setIsPending] = useState(false)

  const importItems = useCallback(
    async (
      scheduleId: number,
      programData: ChurchProgramData,
    ): Promise<ImportResult> => {
      setIsPending(true)

      try {
        const skippedSongs: string[] = []
        const skippedBiblePassages: string[] = []

        // Sort items by sortOrder
        const sortedItems = [...programData.items].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        )

        // Convert items
        const convertedItems: ReplaceScheduleItemsInput['items'] = []
        for (const item of sortedItems) {
          const converted = await convertItem(
            item,
            skippedSongs,
            skippedBiblePassages,
          )
          if (converted) {
            convertedItems.push(converted)
          }
        }

        if (convertedItems.length === 0) {
          return {
            success: false,
            error: 'No items could be imported',
            skippedSongs,
            skippedBiblePassages,
          }
        }

        // Replace schedule items
        const result = await replaceScheduleItems(scheduleId, {
          items: convertedItems,
        })

        if (!result.success) {
          return {
            success: false,
            error: result.error ?? 'Failed to import items',
            skippedSongs,
            skippedBiblePassages,
          }
        }

        return {
          success: true,
          itemCount: convertedItems.length,
          skippedSongs,
          skippedBiblePassages,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      } finally {
        setIsPending(false)
      }
    },
    [],
  )

  return { importItems, isPending }
}

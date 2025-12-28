import { useQueryClient } from '@tanstack/react-query'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { useCallback, useState } from 'react'

import type { ExportedScheduleItem } from '../../schedule-export/types'
import {
  addItemToSchedule,
  upsertSchedule,
} from '../../schedules/service/schedules'
import { searchSongs, upsertSong } from '../../songs/service/songs'
import type { SlideInput } from '../../songs/types'
import type { ImportScheduleResult } from '../types'
import { parseChurchProgram } from '../utils/parseChurchProgram'

const LAST_IMPORT_PATH_KEY = 'church-hub-last-schedule-import-path'

export function useImportScheduleFromFile() {
  const [isPending, setIsPending] = useState(false)
  const queryClient = useQueryClient()

  const importSchedule =
    useCallback(async (): Promise<ImportScheduleResult> => {
      const lastPath = localStorage.getItem(LAST_IMPORT_PATH_KEY)

      const filePath = await open({
        defaultPath: lastPath ?? undefined,
        filters: [{ name: 'Church Program', extensions: ['churchprogram'] }],
        multiple: false,
      })

      if (!filePath) {
        return { success: false, cancelled: true }
      }

      setIsPending(true)
      try {
        // Store directory for next time
        const pathStr = typeof filePath === 'string' ? filePath : filePath[0]
        const lastSlashIndex = Math.max(
          pathStr.lastIndexOf('/'),
          pathStr.lastIndexOf('\\'),
        )
        if (lastSlashIndex > 0) {
          const dirPath = pathStr.substring(0, lastSlashIndex)
          localStorage.setItem(LAST_IMPORT_PATH_KEY, dirPath)
        }

        // Read and parse file
        const content = await readFile(pathStr)
        const decoder = new TextDecoder()
        const jsonContent = decoder.decode(content)

        const parseResult = parseChurchProgram(jsonContent)
        if (!parseResult.success || !parseResult.data) {
          return { success: false, error: parseResult.error }
        }

        const programData = parseResult.data

        // Create the schedule
        const scheduleResult = await upsertSchedule({
          title: programData.schedule.title,
          description: programData.schedule.description,
        })

        if (!scheduleResult.success || !scheduleResult.data) {
          return {
            success: false,
            error: scheduleResult.error ?? 'Failed to create schedule',
          }
        }

        const scheduleId = scheduleResult.data.id
        let songsCreated = 0

        // Process items in order
        for (const item of programData.items.sort(
          (a, b) => a.sortOrder - b.sortOrder,
        )) {
          await processScheduleItem(scheduleId, item, () => {
            songsCreated++
          })
        }

        // Invalidate queries to refresh the UI
        await queryClient.invalidateQueries({ queryKey: ['schedules'] })
        await queryClient.invalidateQueries({ queryKey: ['songs'] })

        return {
          success: true,
          scheduleId,
          songsCreated,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      } finally {
        setIsPending(false)
      }
    }, [queryClient])

  return { importSchedule, isPending }
}

async function processScheduleItem(
  scheduleId: number,
  item: ExportedScheduleItem,
  onSongCreated: () => void,
): Promise<void> {
  if (item.itemType === 'slide') {
    // Add standalone slide
    await addItemToSchedule(scheduleId, {
      slideType: item.slideType,
      slideContent: item.slideContent,
    })
    return
  }

  // Song item
  if (!item.song) return

  // Search for existing song by title
  const searchResults = await searchSongs(item.song.title)
  const exactMatch = searchResults.find(
    (s) => s.title.toLowerCase() === item.song!.title.toLowerCase(),
  )

  let songId: number

  if (exactMatch) {
    songId = exactMatch.id
  } else {
    // Create new song
    const slides: SlideInput[] = item.song.slides.map((slide) => ({
      content: slide.content,
      sortOrder: slide.sortOrder,
      label: slide.label,
    }))

    const songResult = await upsertSong({
      title: item.song.title,
      author: item.song.author,
      copyright: item.song.copyright,
      ccli: item.song.ccli,
      key: item.song.key,
      tempo: item.song.tempo,
      slides,
    })

    if (!songResult.success || !songResult.data) {
      throw new Error(`Failed to create song: ${item.song.title}`)
    }

    songId = songResult.data.id
    onSongCreated()
  }

  // Add song to schedule
  await addItemToSchedule(scheduleId, { songId })
}

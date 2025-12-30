import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { getApiUrl } from '~/config'
import { rebuildSearchIndex } from '~/features/songs/service'
import type { BatchImportInput, BatchImportResult } from '../types'

const BATCH_SIZE = 500 // Increased from 200 for better performance (fewer HTTP requests)

interface BatchImportOptions {
  overwriteDuplicates?: boolean
  skipManuallyEdited?: boolean
}

export function useBatchImportSongs() {
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)
  const [progress, setProgress] = useState(0)

  const batchImport = async (
    input: BatchImportInput,
    options?: BatchImportOptions,
  ): Promise<BatchImportResult> => {
    setIsPending(true)
    setProgress(0)

    const songIds: number[] = []
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    const totalStart = performance.now()
    // biome-ignore lint/suspicious/noConsole: performance logging
    console.log(
      `[PERF] Starting batch import of ${input.songs.length} songs in batches of ${BATCH_SIZE}`,
    )

    try {
      // Process in batches to avoid overwhelming the server
      let batchNum = 0
      for (let i = 0; i < input.songs.length; i += BATCH_SIZE) {
        batchNum++
        const batch = input.songs.slice(i, i + BATCH_SIZE)
        const batchStart = performance.now()

        const response = await fetch(`${getApiUrl()}/api/songs/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songs: batch.map((song) => ({
              title: song.title,
              categoryId: input.categoryId,
              sourceFilename: song.sourceFilename,
              slides: song.slides,
              author: song.author,
              copyright: song.copyright,
              ccli: song.ccli,
              key: song.key,
              tempo: song.tempo,
              timeSignature: song.timeSignature,
              theme: song.theme,
              altTheme: song.altTheme,
              hymnNumber: song.hymnNumber,
              keyLine: song.keyLine,
              presentationOrder: song.presentationOrder,
            })),
            categoryId: input.categoryId,
            overwriteDuplicates: options?.overwriteDuplicates ?? false,
            skipManuallyEdited: options?.skipManuallyEdited ?? false,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            errorData.error || `Batch import failed: ${response.statusText}`,
          )
        }

        const data = (await response.json()) as {
          data: {
            successCount: number
            failedCount: number
            skippedCount: number
            songIds: number[]
            errors: string[]
          }
        }

        songIds.push(...data.data.songIds)
        successCount += data.data.successCount
        failedCount += data.data.failedCount
        skippedCount += data.data.skippedCount

        const batchTime = performance.now() - batchStart
        // biome-ignore lint/suspicious/noConsole: performance logging
        console.log(
          `[PERF] Batch ${batchNum}: ${batchTime.toFixed(0)}ms for ${batch.length} songs (${(batchTime / batch.length).toFixed(2)}ms/song)`,
        )

        // Update progress
        const processed = Math.min(i + BATCH_SIZE, input.songs.length)
        setProgress(Math.round((processed / input.songs.length) * 100))
      }

      const totalTime = performance.now() - totalStart
      // biome-ignore lint/suspicious/noConsole: performance logging
      console.log(
        `[PERF] Total import: ${totalTime.toFixed(0)}ms for ${input.songs.length} songs (${(totalTime / input.songs.length).toFixed(2)}ms/song avg)`,
      )

      // Rebuild FTS search index to ensure all imported songs are searchable
      // This is done as a single batch operation after all songs are imported
      const rebuildStart = performance.now()
      const rebuildResult = await rebuildSearchIndex()
      const rebuildTime = performance.now() - rebuildStart
      // biome-ignore lint/suspicious/noConsole: performance logging
      console.log(
        `[PERF] FTS rebuild: ${rebuildTime.toFixed(0)}ms (server: ${rebuildResult.duration ?? 'N/A'}ms) - ${rebuildResult.success ? 'success' : 'failed'}`,
      )

      queryClient.invalidateQueries({ queryKey: ['songs'] })
    } finally {
      setIsPending(false)
      setProgress(0)
    }

    return { successCount, failedCount, skippedCount, songIds }
  }

  return { batchImport, isPending, progress }
}

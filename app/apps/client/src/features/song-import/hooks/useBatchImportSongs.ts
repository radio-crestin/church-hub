import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { getApiUrl } from '~/config'
import type { BatchImportInput, BatchImportResult } from '../types'

const BATCH_SIZE = 200

interface BatchImportOptions {
  overwriteDuplicates?: boolean
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

    try {
      // Process in batches to avoid overwhelming the server
      for (let i = 0; i < input.songs.length; i += BATCH_SIZE) {
        const batch = input.songs.slice(i, i + BATCH_SIZE)

        const response = await fetch(`${getApiUrl()}/api/songs/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songs: batch.map((song) => ({
              title: song.title,
              categoryId: input.categoryId,
              sourceFilePath: song.sourceFilePath,
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
            songIds: number[]
            errors: string[]
          }
        }

        songIds.push(...data.data.songIds)
        successCount += data.data.successCount
        failedCount += data.data.failedCount

        // Update progress
        const processed = Math.min(i + BATCH_SIZE, input.songs.length)
        setProgress(Math.round((processed / input.songs.length) * 100))
      }

      queryClient.invalidateQueries({ queryKey: ['songs'] })
    } finally {
      setIsPending(false)
      setProgress(0)
    }

    return { successCount, failedCount, songIds }
  }

  return { batchImport, isPending, progress }
}

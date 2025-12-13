import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { useCallback, useState } from 'react'

import { fetchSongsForExport } from '../service'
import type { ExportOptions, ExportProgress, ExportResult } from '../types'
import { createExportZip, generateOpenSongXml } from '../utils'

/**
 * Hook for exporting songs to OpenSong XML format
 */
export function useExportSongs() {
  const [isPending, setIsPending] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)

  const exportSongs = useCallback(
    async (options: ExportOptions): Promise<ExportResult> => {
      // Generate default filename with date
      const date = new Date().toISOString().split('T')[0]
      const defaultFilename = `songs-export-${date}.zip`

      // Show save dialog first so user can choose location
      const savePath = await save({
        defaultPath: defaultFilename,
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      })

      if (!savePath) {
        // User cancelled
        return {
          success: false,
          songCount: 0,
          filename: '',
          error: 'Export cancelled',
        }
      }

      setIsPending(true)
      setProgress({ phase: 'fetching', current: 0, total: 0 })

      try {
        // Fetch songs with slides
        const songs = await fetchSongsForExport(options.categoryId)

        if (songs.length === 0) {
          return {
            success: false,
            songCount: 0,
            filename: '',
            error: 'No songs to export',
          }
        }

        // Generate XML for each song
        setProgress({ phase: 'generating', current: 0, total: songs.length })
        const xmlFiles = songs.map((song, index) => {
          setProgress({
            phase: 'generating',
            current: index + 1,
            total: songs.length,
            currentSong: song.title,
          })
          return {
            filename: song.title,
            xmlContent: generateOpenSongXml(song),
          }
        })

        // Create ZIP archive
        setProgress({ phase: 'zipping', current: 0, total: xmlFiles.length })
        const zipBlob = await createExportZip(xmlFiles, (current, total) => {
          setProgress({ phase: 'zipping', current, total })
        })

        // Write to selected file
        setProgress({ phase: 'saving', current: 0, total: 1 })
        const arrayBuffer = await zipBlob.arrayBuffer()
        await writeFile(savePath, new Uint8Array(arrayBuffer))
        setProgress({ phase: 'saving', current: 1, total: 1 })

        return {
          success: true,
          songCount: songs.length,
          filename: savePath,
        }
      } catch (error) {
        return {
          success: false,
          songCount: 0,
          filename: '',
          error: error instanceof Error ? error.message : String(error),
        }
      } finally {
        setIsPending(false)
        setProgress(null)
      }
    },
    [],
  )

  return { exportSongs, isPending, progress }
}

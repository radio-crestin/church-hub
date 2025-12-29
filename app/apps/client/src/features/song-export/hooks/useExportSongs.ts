import { open, save } from '@tauri-apps/plugin-dialog'
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { useCallback, useState } from 'react'

import { fetchSongsForExport } from '../service'
import type { ExportOptions, ExportProgress, ExportResult } from '../types'
import {
  createExportZip,
  downloadBlob,
  generateOpenSongXml,
  sanitizeFilename,
} from '../utils'

// Check if we're in Tauri (folder export only available in desktop app)
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Hook for exporting songs to OpenSong XML format
 */
export function useExportSongs() {
  const [isPending, setIsPending] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)

  const exportToZip = useCallback(
    async (options: ExportOptions): Promise<ExportResult> => {
      // Generate default filename with date
      const date = new Date().toISOString().split('T')[0]
      const defaultFilename = `songs-export-${date}.zip`

      // For Tauri: show save dialog, for browser: we'll trigger download after
      let savePath: string | null = null
      if (isTauri) {
        savePath = await save({
          defaultPath: defaultFilename,
          filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
        })

        if (!savePath) {
          return {
            success: false,
            cancelled: true,
            songCount: 0,
            filename: '',
          }
        }
      }

      setIsPending(true)
      setProgress({ phase: 'fetching', current: 0, total: 0 })

      try {
        const songs = await fetchSongsForExport(options.categoryId)

        if (songs.length === 0) {
          return {
            success: false,
            songCount: 0,
            filename: '',
            error: 'No songs to export',
          }
        }

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

        setProgress({ phase: 'zipping', current: 0, total: xmlFiles.length })
        const zipBlob = await createExportZip(xmlFiles, (current, total) => {
          setProgress({ phase: 'zipping', current, total })
        })

        setProgress({ phase: 'saving', current: 0, total: 1 })

        if (isTauri && savePath) {
          const arrayBuffer = await zipBlob.arrayBuffer()
          await writeFile(savePath, new Uint8Array(arrayBuffer))
        } else {
          // Browser fallback: trigger download
          downloadBlob(zipBlob, defaultFilename)
        }

        setProgress({ phase: 'saving', current: 1, total: 1 })

        return {
          success: true,
          songCount: songs.length,
          filename: savePath || defaultFilename,
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

  const exportToFolder = useCallback(
    async (options: ExportOptions): Promise<ExportResult> => {
      // Folder export is only available in Tauri
      if (!isTauri) {
        return {
          success: false,
          songCount: 0,
          filename: '',
          error: 'Folder export is only available in desktop app',
        }
      }

      // Show directory picker
      const selectedFolder = await open({
        directory: true,
        multiple: false,
        title: 'Select Export Folder',
      })

      if (!selectedFolder || typeof selectedFolder !== 'string') {
        return {
          success: false,
          cancelled: true,
          songCount: 0,
          filename: '',
        }
      }

      setIsPending(true)
      setProgress({ phase: 'fetching', current: 0, total: 0 })

      try {
        const songs = await fetchSongsForExport(options.categoryId)

        if (songs.length === 0) {
          return {
            success: false,
            songCount: 0,
            filename: '',
            error: 'No songs to export',
          }
        }

        // Generate XML for each song and write directly to folder
        setProgress({ phase: 'writing', current: 0, total: songs.length })

        for (let i = 0; i < songs.length; i++) {
          const song = songs[i]
          const safeFilename = sanitizeFilename(song.title)
          const xmlContent = generateOpenSongXml(song)
          const filePath = `${selectedFolder}/${safeFilename}`

          await writeTextFile(filePath, xmlContent)

          setProgress({
            phase: 'writing',
            current: i + 1,
            total: songs.length,
            currentSong: song.title,
          })
        }

        return {
          success: true,
          songCount: songs.length,
          filename: selectedFolder,
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

  const exportSongs = useCallback(
    async (options: ExportOptions): Promise<ExportResult> => {
      if (options.format === 'folder') {
        return exportToFolder(options)
      }
      return exportToZip(options)
    },
    [exportToFolder, exportToZip],
  )

  return { exportSongs, isPending, progress }
}

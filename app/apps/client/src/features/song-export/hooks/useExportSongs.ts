import { join } from '@tauri-apps/api/path'
import { open, save } from '@tauri-apps/plugin-dialog'
import { mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { useCallback, useState } from 'react'

import type { SongWithSlides } from '~/features/songs/types'
import { fetchSongsForExport } from '../service'
import type {
  ExportOptions,
  ExportProgress,
  ExportResult,
  SongFileFormat,
} from '../types'
import {
  downloadBlob,
  generateOpenSongXml,
  generatePptxBase64,
  sanitizeFilename,
} from '../utils'

// Check if we're in Tauri (folder export only available in desktop app)
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Batch size for parallel processing
const PARALLEL_BATCH_SIZE = 10

/**
 * Get file extension for the given format
 */
function getFileExtension(format: SongFileFormat): string {
  return format === 'pptx' ? 'pptx' : 'opensong'
}

/**
 * Generate file content for a song in the specified format
 */
async function generateFileContent(
  song: SongWithSlides,
  format: SongFileFormat,
): Promise<Uint8Array> {
  if (format === 'pptx') {
    const base64Data = await generatePptxBase64(song)
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }
  // OpenSong XML
  const xmlContent = generateOpenSongXml(song)
  return new TextEncoder().encode(xmlContent)
}

/**
 * Process songs in parallel batches
 */
async function processSongsInBatches<T>(
  songs: SongWithSlides[],
  processor: (song: SongWithSlides, index: number) => Promise<T>,
  onProgress: (current: number, total: number, currentSong?: string) => void,
): Promise<T[]> {
  const results: T[] = []
  let processed = 0

  for (let i = 0; i < songs.length; i += PARALLEL_BATCH_SIZE) {
    const batch = songs.slice(i, i + PARALLEL_BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (song, batchIndex) => {
        const result = await processor(song, i + batchIndex)
        processed++
        onProgress(processed, songs.length, song.title)
        return result
      }),
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * Hook for exporting songs to OpenSong XML or PPTX format
 */
export function useExportSongs() {
  const [isPending, setIsPending] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)

  const exportToZip = useCallback(
    async (options: ExportOptions): Promise<ExportResult> => {
      const { fileFormat } = options
      const extension = getFileExtension(fileFormat)
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

        // Generate files in parallel batches
        setProgress({ phase: 'generating', current: 0, total: songs.length })

        const files = await processSongsInBatches(
          songs,
          async (song) => {
            const content = await generateFileContent(song, fileFormat)
            const categoryFolder = song.category
              ? sanitizeFilename(song.category.name)
              : 'Uncategorized'
            return {
              filename: `${categoryFolder}/${sanitizeFilename(song.title)}.${extension}`,
              content,
            }
          },
          (current, total, currentSong) => {
            setProgress({ phase: 'generating', current, total, currentSong })
          },
        )

        // Create ZIP archive
        setProgress({ phase: 'zipping', current: 0, total: files.length })

        // For ZIP, we need to convert to the format createExportZip expects
        // Since createExportZip expects string content, we need to handle binary differently
        const { default: JSZip } = await import('jszip')
        const zip = new JSZip()

        for (let i = 0; i < files.length; i++) {
          const { filename, content } = files[i]
          zip.file(filename, content)
          setProgress({ phase: 'zipping', current: i + 1, total: files.length })
        }

        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
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

      const { fileFormat } = options
      const extension = getFileExtension(fileFormat)

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

        // Create category folders first
        const categoryNames = new Set<string>()
        for (const song of songs) {
          const categoryFolder = song.category
            ? sanitizeFilename(song.category.name)
            : 'Uncategorized'
          categoryNames.add(categoryFolder)
        }

        for (const categoryName of categoryNames) {
          const categoryPath = await join(selectedFolder, categoryName)
          try {
            await mkdir(categoryPath, { recursive: true })
          } catch (mkdirError) {
            throw mkdirError
          }
        }

        // Generate and write files in parallel batches
        setProgress({ phase: 'writing', current: 0, total: songs.length })

        await processSongsInBatches(
          songs,
          async (song) => {
            const categoryFolder = song.category
              ? sanitizeFilename(song.category.name)
              : 'Uncategorized'
            const safeFilename = sanitizeFilename(song.title)
            const filePath = await join(
              selectedFolder,
              categoryFolder,
              `${safeFilename}.${extension}`,
            )
            const content = await generateFileContent(song, fileFormat)
            try {
              await writeFile(filePath, content)
            } catch (writeError) {
              throw writeError
            }
            return filePath
          },
          (current, total, currentSong) => {
            setProgress({ phase: 'writing', current, total, currentSong })
          },
        )

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
      if (options.destination === 'folder') {
        return exportToFolder(options)
      }
      return exportToZip(options)
    },
    [exportToFolder, exportToZip],
  )

  return { exportSongs, isPending, progress }
}

import { yieldToMain } from '~/utils/async-utils'
import {
  convertPptToPptx,
  LibreOfficeNotInstalledError,
} from './convertPptToPptx'
import { extractFilesFromZip } from './extractPptxFromZip'
import { parseOpenSongXml } from './parseOpenSong'
import { parsePptxFile } from './parsePptx'
import type {
  ImportProgress,
  ProcessedImport,
  ProcessImportResult,
} from '../types'

const PARALLEL_CHUNK_SIZE = 5

/**
 * Processes chunks in parallel with a concurrency limit.
 * Yields to main thread between chunks to prevent UI freezes.
 */
async function processInChunks<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  chunkSize: number,
  onChunkComplete?: (processed: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = []
  const total = items.length

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const chunkResults = await Promise.all(
      chunk.map((item, idx) => processor(item, i + idx)),
    )
    results.push(...chunkResults)
    onChunkComplete?.(Math.min(i + chunkSize, total), total)

    // Yield to main thread between chunks to keep UI responsive
    await yieldToMain()
  }

  return results
}

/**
 * Processes a ZIP buffer (containing PPTX, PPT, and OpenSong files) into parsed songs
 * Uses parallel processing for faster extraction and parsing
 */
export async function processZipFromBuffer(
  zipData: ArrayBuffer,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ProcessImportResult> {
  const songs: ProcessedImport[] = []
  const errors: string[] = []

  onProgress?.({
    phase: 'extracting',
    current: 0,
    total: 1,
    currentFile: 'ZIP archive',
  })

  const extractResult = await extractFilesFromZip(zipData, (current, total) => {
    onProgress?.({
      phase: 'extracting',
      current,
      total,
      currentFile: 'ZIP archive',
    })
  })

  errors.push(...extractResult.errors)

  // Parse extracted PPTX files in parallel
  if (extractResult.pptxFiles.length > 0) {
    onProgress?.({
      phase: 'parsing',
      current: 0,
      total: extractResult.pptxFiles.length,
      currentFile: 'PPTX files',
    })

    const pptxResults = await processInChunks(
      extractResult.pptxFiles,
      async (pptxFile) => {
        try {
          const parsed = await parsePptxFile(pptxFile.data, pptxFile.filename)
          return {
            success: true as const,
            data: {
              parsed,
              sourceFilename: pptxFile.filename,
              sourceFormat: 'pptx' as const,
            },
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false as const,
            error: `Failed to parse ${pptxFile.filename}: ${message}`,
          }
        }
      },
      PARALLEL_CHUNK_SIZE,
      (current, total) => {
        onProgress?.({
          phase: 'parsing',
          current,
          total,
          currentFile: 'PPTX files',
        })
      },
    )

    for (const result of pptxResults) {
      if (result.success) {
        songs.push(result.data)
      } else {
        errors.push(result.error)
      }
    }
  }

  // Convert and parse extracted PPT files
  if (extractResult.pptFiles.length > 0) {
    onProgress?.({
      phase: 'converting',
      current: 0,
      total: extractResult.pptFiles.length,
      currentFile: 'PPT files',
    })

    const pptResults = await processInChunks(
      extractResult.pptFiles,
      async (pptFile) => {
        try {
          const pptxData = await convertPptToPptx(pptFile.data)
          const parsed = await parsePptxFile(pptxData, pptFile.filename)
          return {
            success: true as const,
            data: {
              parsed,
              sourceFilename: pptFile.filename,
              sourceFormat: 'pptx' as const,
            },
          }
        } catch (error) {
          if (error instanceof LibreOfficeNotInstalledError) {
            return {
              success: false as const,
              error: 'LIBREOFFICE_NOT_INSTALLED',
            }
          }
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false as const,
            error: `Failed to convert ${pptFile.filename}: ${message}`,
          }
        }
      },
      PARALLEL_CHUNK_SIZE,
      (current, total) => {
        onProgress?.({
          phase: 'converting',
          current,
          total,
          currentFile: 'PPT files',
        })
      },
    )

    for (const result of pptResults) {
      if (result.success) {
        songs.push(result.data)
      } else {
        errors.push(result.error)
      }
    }
  }

  // Parse extracted OpenSong files in parallel
  if (extractResult.opensongFiles.length > 0) {
    onProgress?.({
      phase: 'parsing',
      current: 0,
      total: extractResult.opensongFiles.length,
      currentFile: 'OpenSong files',
    })

    const opensongResults = await processInChunks(
      extractResult.opensongFiles,
      async (opensongFile) => {
        try {
          const parsed = parseOpenSongXml(
            opensongFile.content,
            opensongFile.filename,
          )
          return {
            success: true as const,
            data: {
              parsed,
              sourceFilename: opensongFile.filename,
              sourceFormat: 'opensong' as const,
            },
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false as const,
            error: `Failed to parse ${opensongFile.filename}: ${message}`,
          }
        }
      },
      PARALLEL_CHUNK_SIZE,
      (current, total) => {
        onProgress?.({
          phase: 'parsing',
          current,
          total,
          currentFile: 'OpenSong files',
        })
      },
    )

    for (const result of opensongResults) {
      if (result.success) {
        songs.push(result.data)
      } else {
        errors.push(result.error)
      }
    }
  }

  return { songs, errors }
}

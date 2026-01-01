import JSZip from 'jszip'

import { yieldToMain } from '~/utils/async-utils'
import type {
  ExtractedOpenSongFile,
  ExtractedPptFile,
  ExtractedPptxFile,
  ExtractResult,
} from '../types'

const PARALLEL_CHUNK_SIZE = 10

/**
 * Checks if a file might be an OpenSong file based on path
 * OpenSong files often have no extension or .xml extension
 */
function isOpenSongCandidate(filePath: string): boolean {
  const filename = filePath.split(/[/\\]/).pop() || ''
  const lowerPath = filePath.toLowerCase()

  // Skip common non-song files
  if (
    lowerPath.includes('__macosx') ||
    lowerPath.includes('.ds_store') ||
    filename.startsWith('.')
  ) {
    return false
  }

  // OpenSong files: .xml extension OR no extension at all
  return lowerPath.endsWith('.xml') || !filename.includes('.')
}

/**
 * Quickly checks if text content looks like OpenSong XML
 */
function isOpenSongContent(content: string): boolean {
  const trimmed = content.trim()
  return trimmed.startsWith('<song') && trimmed.includes('<lyrics>')
}

/**
 * Processes chunks in parallel with a concurrency limit.
 * Yields to main thread between chunks to prevent UI freezes.
 */
async function processInChunks<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  chunkSize: number,
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const chunkResults = await Promise.all(chunk.map(processor))
    results.push(...chunkResults)

    // Yield to main thread between chunks to keep UI responsive
    await yieldToMain()
  }

  return results
}

interface FileEntry {
  path: string
  file: JSZip.JSZipObject
}

/**
 * Recursively extracts all PPTX, PPT, and OpenSong files from a ZIP archive
 * Uses parallel processing for faster extraction
 * PPT files are returned separately for server-side conversion to PPTX
 */
export async function extractFilesFromZip(
  zipData: ArrayBuffer,
  onProgress?: (current: number, total: number) => void,
): Promise<ExtractResult> {
  const pptxFiles: ExtractedPptxFile[] = []
  const pptFiles: ExtractedPptFile[] = []
  const opensongFiles: ExtractedOpenSongFile[] = []
  const errors: string[] = []

  try {
    const zip = await JSZip.loadAsync(zipData)
    const allFilePaths = Object.keys(zip.files)

    // Filter to only non-directory files
    const fileEntries: FileEntry[] = allFilePaths
      .filter((path) => !zip.files[path].dir)
      .map((path) => ({ path, file: zip.files[path] }))

    const total = fileEntries.length
    let processed = 0

    // Categorize files by type for efficient parallel processing
    const pptxEntries: FileEntry[] = []
    const pptEntries: FileEntry[] = []
    const opensongEntries: FileEntry[] = []
    const nestedZipEntries: FileEntry[] = []

    for (const entry of fileEntries) {
      const lowerPath = entry.path.toLowerCase()
      if (lowerPath.endsWith('.pptx')) {
        pptxEntries.push(entry)
      } else if (lowerPath.endsWith('.ppt')) {
        pptEntries.push(entry)
      } else if (lowerPath.endsWith('.zip')) {
        nestedZipEntries.push(entry)
      } else if (isOpenSongCandidate(entry.path)) {
        opensongEntries.push(entry)
      }
    }

    // Process PPTX files in parallel
    const pptxResults = await processInChunks(
      pptxEntries,
      async (entry) => {
        try {
          const data = await entry.file.async('arraybuffer')
          const filename = entry.path.split(/[/\\]/).pop() || entry.path
          processed++
          onProgress?.(processed, total)
          return {
            success: true as const,
            data: {
              filename,
              data,
              sourcePath: entry.path,
            },
          }
        } catch (error) {
          processed++
          onProgress?.(processed, total)
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false as const,
            error: `Failed to extract ${entry.path}: ${message}`,
          }
        }
      },
      PARALLEL_CHUNK_SIZE,
    )

    for (const result of pptxResults) {
      if (result.success) {
        pptxFiles.push(result.data)
      } else {
        errors.push(result.error)
      }
    }

    // Process PPT files in parallel (will be converted to PPTX later)
    const pptResults = await processInChunks(
      pptEntries,
      async (entry) => {
        try {
          const data = await entry.file.async('arraybuffer')
          const filename = entry.path.split(/[/\\]/).pop() || entry.path
          processed++
          onProgress?.(processed, total)
          return {
            success: true as const,
            data: {
              filename,
              data,
              sourcePath: entry.path,
            },
          }
        } catch (error) {
          processed++
          onProgress?.(processed, total)
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false as const,
            error: `Failed to extract ${entry.path}: ${message}`,
          }
        }
      },
      PARALLEL_CHUNK_SIZE,
    )

    for (const result of pptResults) {
      if (result.success) {
        pptFiles.push(result.data)
      } else {
        errors.push(result.error)
      }
    }

    // Process OpenSong files in parallel
    const opensongResults = await processInChunks(
      opensongEntries,
      async (entry) => {
        try {
          const data = await entry.file.async('uint8array')
          const content = new TextDecoder().decode(data)
          processed++
          onProgress?.(processed, total)

          // Verify it's actually OpenSong format
          if (isOpenSongContent(content)) {
            const filename = entry.path.split(/[/\\]/).pop() || entry.path
            return {
              success: true as const,
              data: {
                filename,
                content,
                sourcePath: entry.path,
              },
            }
          }
          return { success: false as const, error: null }
        } catch (error) {
          processed++
          onProgress?.(processed, total)
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false as const,
            error: `Failed to extract ${entry.path}: ${message}`,
          }
        }
      },
      PARALLEL_CHUNK_SIZE,
    )

    for (const result of opensongResults) {
      if (result.success && result.data) {
        opensongFiles.push(result.data)
      } else if (result.error) {
        errors.push(result.error)
      }
    }

    // Process nested ZIPs recursively (one at a time to avoid memory issues)
    for (const entry of nestedZipEntries) {
      try {
        // Yield before processing each nested ZIP to keep UI responsive
        await yieldToMain()

        const nestedZipData = await entry.file.async('arraybuffer')
        const nestedResult = await extractFilesFromZip(
          nestedZipData,
          (current, nestedTotal) => {
            onProgress?.(processed + current, total + nestedTotal)
          },
        )
        pptxFiles.push(...nestedResult.pptxFiles)
        pptFiles.push(...nestedResult.pptFiles)
        opensongFiles.push(...nestedResult.opensongFiles)
        errors.push(...nestedResult.errors)
        processed++
        onProgress?.(processed, total)
      } catch (error) {
        processed++
        onProgress?.(processed, total)
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Failed to process nested ZIP ${entry.path}: ${message}`)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Failed to open ZIP archive: ${message}`)
  }

  return { pptxFiles, pptFiles, opensongFiles, errors }
}

/**
 * @deprecated Use extractFilesFromZip instead
 * Legacy function for backwards compatibility - only extracts PPTX
 */
export async function extractPptxFromZip(
  zipData: ArrayBuffer,
): Promise<{ pptxFiles: ExtractedPptxFile[]; errors: string[] }> {
  const result = await extractFilesFromZip(zipData)
  return {
    pptxFiles: result.pptxFiles,
    errors: result.errors,
  }
}

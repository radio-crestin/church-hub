import { readFile } from '@tauri-apps/plugin-fs'

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
 * Checks if a file might be an OpenSong file based on path
 * OpenSong files often have no extension
 */
function mightBeOpenSongFile(filePath: string): boolean {
  const filename = filePath.split(/[/\\]/).pop() || ''
  const lowerPath = filePath.toLowerCase()
  // Has .xml extension or no extension at all
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
 * Processes chunks in parallel with a concurrency limit
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
  }

  return results
}

/**
 * Processes selected files (PPTX, OpenSong XML, and ZIP) into parsed songs
 * Uses parallel processing for faster extraction and parsing
 */
export async function processImportFiles(
  filePaths: string[],
  onProgress?: (progress: ImportProgress) => void,
): Promise<ProcessImportResult> {
  const songs: ProcessedImport[] = []
  const errors: string[] = []

  // Categorize files by type
  const pptxPaths: string[] = []
  const zipPaths: string[] = []
  const opensongPaths: string[] = []

  for (const filePath of filePaths) {
    const lowerPath = filePath.toLowerCase()
    if (lowerPath.endsWith('.pptx')) {
      pptxPaths.push(filePath)
    } else if (lowerPath.endsWith('.zip')) {
      zipPaths.push(filePath)
    } else if (mightBeOpenSongFile(filePath)) {
      opensongPaths.push(filePath)
    }
  }

  const totalFiles = pptxPaths.length + zipPaths.length + opensongPaths.length
  let processedFiles = 0

  // Process ZIP files first (they may contain many songs)
  for (const zipPath of zipPaths) {
    onProgress?.({
      phase: 'extracting',
      current: processedFiles,
      total: totalFiles,
      currentFile: zipPath.split(/[/\\]/).pop(),
    })

    try {
      const fileData = await readFile(zipPath)
      const extractResult = await extractFilesFromZip(
        fileData.buffer,
        (current, total) => {
          onProgress?.({
            phase: 'extracting',
            current,
            total,
            currentFile: zipPath.split(/[/\\]/).pop(),
          })
        },
      )

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
              const parsed = await parsePptxFile(
                pptxFile.data,
                pptxFile.filename,
              )
              return {
                success: true as const,
                data: {
                  parsed,
                  sourceFilePath: null,
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
                  sourceFilePath: null,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const filename = zipPath.split(/[/\\]/).pop() || zipPath
      errors.push(`Failed to read ${filename}: ${message}`)
    }

    processedFiles++
  }

  // Process standalone PPTX files in parallel
  if (pptxPaths.length > 0) {
    onProgress?.({
      phase: 'parsing',
      current: 0,
      total: pptxPaths.length,
      currentFile: 'PPTX files',
    })

    const pptxResults = await processInChunks(
      pptxPaths,
      async (filePath) => {
        try {
          const fileData = await readFile(filePath)
          const parsed = await parsePptxFile(fileData.buffer, filePath)
          return {
            success: true as const,
            data: {
              parsed,
              sourceFilePath: filePath,
              sourceFormat: 'pptx' as const,
            },
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          const filename = filePath.split(/[/\\]/).pop() || filePath
          return {
            success: false as const,
            error: `Failed to process ${filename}: ${message}`,
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

  // Process standalone OpenSong files in parallel
  if (opensongPaths.length > 0) {
    onProgress?.({
      phase: 'parsing',
      current: 0,
      total: opensongPaths.length,
      currentFile: 'OpenSong files',
    })

    const opensongResults = await processInChunks(
      opensongPaths,
      async (filePath) => {
        try {
          const fileData = await readFile(filePath)
          const textContent = new TextDecoder().decode(fileData)

          // Verify it's actually OpenSong format
          if (isOpenSongContent(textContent)) {
            const parsed = parseOpenSongXml(textContent, filePath)
            return {
              success: true as const,
              data: {
                parsed,
                sourceFilePath: filePath,
                sourceFormat: 'opensong' as const,
              },
            }
          }

          const filename = filePath.split(/[/\\]/).pop() || filePath
          return {
            success: false as const,
            error: `${filename}: Not a valid OpenSong file`,
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          const filename = filePath.split(/[/\\]/).pop() || filePath
          return {
            success: false as const,
            error: `Failed to parse ${filename} as OpenSong: ${message}`,
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
      } else if (
        result.error &&
        !result.error.includes('Not a valid OpenSong')
      ) {
        // Only add actual errors, not validation failures
        errors.push(result.error)
      }
    }
  }

  return { songs, errors }
}

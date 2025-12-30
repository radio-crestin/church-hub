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
 * Checks if a file might be an OpenSong file based on name
 * OpenSong files often have no extension or .opensong extension
 */
function mightBeOpenSongFile(filename: string): boolean {
  const lowerName = filename.toLowerCase()
  // Has .xml, .opensong extension, or no extension at all
  return (
    lowerName.endsWith('.xml') ||
    lowerName.endsWith('.opensong') ||
    !filename.includes('.')
  )
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
 * Processes File objects (from web file input) into parsed songs
 * This is the web-compatible version of processImportFiles
 */
export async function processImportFilesWeb(
  files: File[],
  onProgress?: (progress: ImportProgress) => void,
): Promise<ProcessImportResult> {
  const songs: ProcessedImport[] = []
  const errors: string[] = []

  // Categorize files by type
  const pptFiles: File[] = []
  const pptxFiles: File[] = []
  const zipFiles: File[] = []
  const opensongFiles: File[] = []

  for (const file of files) {
    const lowerName = file.name.toLowerCase()
    if (lowerName.endsWith('.pptx')) {
      pptxFiles.push(file)
    } else if (lowerName.endsWith('.ppt')) {
      pptFiles.push(file)
    } else if (lowerName.endsWith('.zip')) {
      zipFiles.push(file)
    } else if (mightBeOpenSongFile(file.name)) {
      opensongFiles.push(file)
    }
  }

  const totalFiles =
    pptFiles.length + pptxFiles.length + zipFiles.length + opensongFiles.length
  let processedFiles = 0

  // Process PPT files first (convert to PPTX via server)
  if (pptFiles.length > 0) {
    onProgress?.({
      phase: 'converting',
      current: 0,
      total: pptFiles.length,
      currentFile: 'PPT files',
    })

    const pptResults = await processInChunks(
      pptFiles,
      async (file) => {
        try {
          const fileData = await file.arrayBuffer()

          // Convert PPT to PPTX via server
          const pptxData = await convertPptToPptx(fileData)

          // Parse converted PPTX
          const parsed = await parsePptxFile(pptxData, file.name)
          return {
            success: true as const,
            data: {
              parsed,
              sourceFilename: file.name,
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
            error: `Failed to convert ${file.name}: ${message}`,
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

  // Process ZIP files (they may contain many songs)
  for (const zipFile of zipFiles) {
    onProgress?.({
      phase: 'extracting',
      current: processedFiles,
      total: totalFiles,
      currentFile: zipFile.name,
    })

    try {
      const fileData = await zipFile.arrayBuffer()
      const extractResult = await extractFilesFromZip(
        fileData,
        (current, total) => {
          onProgress?.({
            phase: 'extracting',
            current,
            total,
            currentFile: zipFile.name,
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
          currentFile: 'PPT files from ZIP',
        })

        const pptResults = await processInChunks(
          extractResult.pptFiles,
          async (pptFile) => {
            try {
              // Convert PPT to PPTX via server
              const pptxData = await convertPptToPptx(pptFile.data)

              // Parse converted PPTX
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
              currentFile: 'PPT files from ZIP',
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Failed to read ${zipFile.name}: ${message}`)
    }

    processedFiles++
  }

  // Process standalone PPTX files in parallel
  if (pptxFiles.length > 0) {
    onProgress?.({
      phase: 'parsing',
      current: 0,
      total: pptxFiles.length,
      currentFile: 'PPTX files',
    })

    const pptxResults = await processInChunks(
      pptxFiles,
      async (file) => {
        try {
          const parsed = await parsePptxFile(file)
          return {
            success: true as const,
            data: {
              parsed,
              sourceFilename: file.name,
              sourceFormat: 'pptx' as const,
            },
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false as const,
            error: `Failed to process ${file.name}: ${message}`,
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
  if (opensongFiles.length > 0) {
    onProgress?.({
      phase: 'parsing',
      current: 0,
      total: opensongFiles.length,
      currentFile: 'OpenSong files',
    })

    const opensongResults = await processInChunks(
      opensongFiles,
      async (file) => {
        try {
          const textContent = await file.text()

          // Verify it's actually OpenSong format
          if (isOpenSongContent(textContent)) {
            const parsed = parseOpenSongXml(textContent, file.name)
            return {
              success: true as const,
              data: {
                parsed,
                sourceFilename: file.name,
                sourceFormat: 'opensong' as const,
              },
            }
          }

          return {
            success: false as const,
            error: `${file.name}: Not a valid OpenSong file`,
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false as const,
            error: `Failed to parse ${file.name} as OpenSong: ${message}`,
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

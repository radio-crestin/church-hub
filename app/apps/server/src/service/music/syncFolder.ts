import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { eq, inArray } from 'drizzle-orm'

import { extractAudioMetadata } from './extractAudioMetadata'
import type { AudioFormat, SyncResult } from './types'
import { SUPPORTED_AUDIO_FORMATS } from './types'
import { getDatabase } from '../../db'
import { musicFiles, musicFolders } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('music/sync')

// Concurrency limit for parallel metadata extraction
const METADATA_CONCURRENCY = 10

function getAudioFormat(filename: string): AudioFormat | null {
  const ext = extname(filename).toLowerCase().slice(1)
  return SUPPORTED_AUDIO_FORMATS.includes(ext as AudioFormat)
    ? (ext as AudioFormat)
    : null
}

async function collectAudioFiles(
  dirPath: string,
  recursive: boolean,
): Promise<{ path: string; format: AudioFormat }[]> {
  const files: { path: string; format: AudioFormat }[] = []

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory() && recursive) {
        const subFiles = await collectAudioFiles(fullPath, recursive)
        files.push(...subFiles)
      } else if (entry.isFile()) {
        const format = getAudioFormat(entry.name)
        if (format) {
          files.push({ path: fullPath, format })
        }
      }
    }
  } catch (error) {
    logger.error(`Failed to read directory ${dirPath}: ${error}`)
  }

  return files
}

/**
 * Process files in batches with concurrency limiting
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = []
  const executing: Promise<void>[] = []

  for (const item of items) {
    const promise = processor(item).then((result) => {
      results.push(result)
    })

    executing.push(promise)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
      // Remove completed promises
      const completedIndex = executing.findIndex((p) =>
        Promise.race([p, Promise.resolve('pending')]).then(
          (v) => v !== 'pending',
        ),
      )
      if (completedIndex !== -1) {
        executing.splice(completedIndex, 1)
      }
    }
  }

  await Promise.all(executing)
  return results
}

export async function syncFolder(folderId: number): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    filesAdded: 0,
    filesRemoved: 0,
    filesUpdated: 0,
    errors: [],
  }

  const db = getDatabase()

  try {
    const folder = db
      .select()
      .from(musicFolders)
      .where(eq(musicFolders.id, folderId))
      .get()

    if (!folder) {
      result.errors.push('Folder not found')
      return result
    }

    logger.info(`Scanning folder: ${folder.path}`)

    const audioFiles = await collectAudioFiles(folder.path, folder.isRecursive)
    const existingFilePaths = new Set(audioFiles.map((f) => f.path))

    const dbFiles = db
      .select()
      .from(musicFiles)
      .where(eq(musicFiles.folderId, folderId))
      .all()

    const dbFilePaths = new Map(dbFiles.map((f) => [f.path, f]))

    // Batch delete removed files in a single query
    const removedFileIds = dbFiles
      .filter((dbFile) => !existingFilePaths.has(dbFile.path))
      .map((dbFile) => dbFile.id)

    if (removedFileIds.length > 0) {
      db.delete(musicFiles).where(inArray(musicFiles.id, removedFileIds)).run()
      result.filesRemoved = removedFileIds.length
    }

    const now = new Date()

    // Separate files into new files and files needing update
    type FileToProcess = {
      audioFile: { path: string; format: AudioFormat }
      existingFile: (typeof dbFiles)[0] | undefined
      isNew: boolean
      needsUpdate: boolean
    }

    // Get file stats in parallel (with concurrency limit)
    const filesToProcess: FileToProcess[] = []

    await processWithConcurrency(
      audioFiles,
      async (audioFile) => {
        const existingFile = dbFilePaths.get(audioFile.path)
        try {
          const fileStat = await stat(audioFile.path)
          const isNew = !existingFile
          const needsUpdate =
            !isNew &&
            existingFile?.lastModified?.getTime() !== fileStat.mtime.getTime()

          if (isNew || needsUpdate) {
            filesToProcess.push({
              audioFile,
              existingFile,
              isNew,
              needsUpdate,
            })
          }
        } catch (error) {
          result.errors.push(`Failed to stat ${audioFile.path}: ${error}`)
        }
      },
      METADATA_CONCURRENCY * 2, // Higher concurrency for stat() which is fast
    )

    // Process files needing metadata extraction in parallel
    type ProcessedFile = {
      audioFile: { path: string; format: AudioFormat }
      existingFile: (typeof dbFiles)[0] | undefined
      isNew: boolean
      metadata: Awaited<ReturnType<typeof extractAudioMetadata>>
      fileStat: { size: number; mtime: Date }
    }

    const processedFiles: ProcessedFile[] = []

    await processWithConcurrency(
      filesToProcess,
      async ({ audioFile, existingFile, isNew }) => {
        try {
          const [metadata, fileStat] = await Promise.all([
            extractAudioMetadata(audioFile.path),
            stat(audioFile.path),
          ])

          processedFiles.push({
            audioFile,
            existingFile,
            isNew,
            metadata,
            fileStat,
          })
        } catch (error) {
          result.errors.push(`Failed to process ${audioFile.path}: ${error}`)
        }
      },
      METADATA_CONCURRENCY,
    )

    // Batch insert new files
    const newFiles = processedFiles.filter((f) => f.isNew)
    if (newFiles.length > 0) {
      const insertValues = newFiles.map((f) => ({
        folderId,
        path: f.audioFile.path,
        filename: basename(f.audioFile.path),
        title:
          f.metadata.title ??
          basename(f.audioFile.path, extname(f.audioFile.path)),
        artist: f.metadata.artist,
        album: f.metadata.album,
        genre: f.metadata.genre,
        year: f.metadata.year,
        trackNumber: f.metadata.trackNumber,
        duration: f.metadata.duration,
        format: f.audioFile.format,
        fileSize: f.fileStat.size,
        lastModified: f.fileStat.mtime,
        createdAt: now,
        updatedAt: now,
      }))

      db.insert(musicFiles).values(insertValues).run()
      result.filesAdded = newFiles.length
    }

    // Update modified files individually (updates with different values can't be batched easily)
    const updatedFiles = processedFiles.filter(
      (f) => !f.isNew && f.existingFile,
    )
    for (const f of updatedFiles) {
      db.update(musicFiles)
        .set({
          title:
            f.metadata.title ??
            basename(f.audioFile.path, extname(f.audioFile.path)),
          artist: f.metadata.artist,
          album: f.metadata.album,
          genre: f.metadata.genre,
          year: f.metadata.year,
          trackNumber: f.metadata.trackNumber,
          duration: f.metadata.duration,
          fileSize: f.fileStat.size,
          lastModified: f.fileStat.mtime,
          updatedAt: now,
        })
        .where(eq(musicFiles.id, f.existingFile!.id))
        .run()
    }
    result.filesUpdated = updatedFiles.length

    db.update(musicFolders)
      .set({
        lastSyncAt: now,
        fileCount: audioFiles.length,
        updatedAt: now,
      })
      .where(eq(musicFolders.id, folderId))
      .run()

    result.success = true
    logger.info(
      `Complete: +${result.filesAdded} -${result.filesRemoved} ~${result.filesUpdated} (parallel processing)`,
    )
  } catch (error) {
    result.errors.push(`Sync failed: ${error}`)
    logger.error(`Sync failed: ${error}`)
  }

  return result
}

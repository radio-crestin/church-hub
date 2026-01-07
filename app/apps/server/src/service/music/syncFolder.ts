import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { eq } from 'drizzle-orm'

import type { AudioFormat, SyncResult } from './types'
import { SUPPORTED_AUDIO_FORMATS } from './types'
import { getDatabase } from '../../db'
import { musicFiles, musicFolders } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('music/sync')

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

    for (const dbFile of dbFiles) {
      if (!existingFilePaths.has(dbFile.path)) {
        db.delete(musicFiles).where(eq(musicFiles.id, dbFile.id)).run()
        result.filesRemoved++
      }
    }

    const now = new Date()
    for (const audioFile of audioFiles) {
      const existingFile = dbFilePaths.get(audioFile.path)

      try {
        const fileStat = await stat(audioFile.path)

        if (!existingFile) {
          const filename = basename(audioFile.path)
          const title = basename(audioFile.path, extname(audioFile.path))

          db.insert(musicFiles)
            .values({
              folderId,
              path: audioFile.path,
              filename,
              title,
              format: audioFile.format,
              fileSize: fileStat.size,
              lastModified: fileStat.mtime,
              createdAt: now,
              updatedAt: now,
            })
            .run()
          result.filesAdded++
        } else if (
          existingFile.lastModified?.getTime() !== fileStat.mtime.getTime()
        ) {
          db.update(musicFiles)
            .set({
              fileSize: fileStat.size,
              lastModified: fileStat.mtime,
              updatedAt: now,
            })
            .where(eq(musicFiles.id, existingFile.id))
            .run()
          result.filesUpdated++
        }
      } catch (error) {
        result.errors.push(`Failed to process ${audioFile.path}: ${error}`)
      }
    }

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
      `Complete: +${result.filesAdded} -${result.filesRemoved} ~${result.filesUpdated}`,
    )
  } catch (error) {
    result.errors.push(`Sync failed: ${error}`)
    logger.error(`Sync failed: ${error}`)
  }

  return result
}

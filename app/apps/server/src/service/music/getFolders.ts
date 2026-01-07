import { eq } from 'drizzle-orm'

import type { MusicFolder } from './types'
import { getDatabase } from '../../db'
import { musicFolders } from '../../db/schema'

export function getFolders(): MusicFolder[] {
  const db = getDatabase()

  const rows = db.select().from(musicFolders).all()

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    name: row.name,
    isRecursive: row.isRecursive,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.getTime() : null,
    fileCount: row.fileCount,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }))
}

export function getFolderById(id: number): MusicFolder | null {
  const db = getDatabase()

  const row = db
    .select()
    .from(musicFolders)
    .where(eq(musicFolders.id, id))
    .get()

  if (!row) return null

  return {
    id: row.id,
    path: row.path,
    name: row.name,
    isRecursive: row.isRecursive,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.getTime() : null,
    fileCount: row.fileCount,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

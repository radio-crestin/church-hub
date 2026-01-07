import { and, eq, like, or } from 'drizzle-orm'

import type { GetFilesInput, MusicFile, MusicFileWithFolder } from './types'
import { getDatabase } from '../../db'
import { musicFiles, musicFolders } from '../../db/schema'

export function getFiles(input: GetFilesInput = {}): MusicFile[] {
  const db = getDatabase()

  const conditions = []

  if (input.folderId) {
    conditions.push(eq(musicFiles.folderId, input.folderId))
  }

  if (input.format) {
    conditions.push(eq(musicFiles.format, input.format))
  }

  if (input.artist) {
    conditions.push(like(musicFiles.artist, `%${input.artist}%`))
  }

  if (input.album) {
    conditions.push(like(musicFiles.album, `%${input.album}%`))
  }

  if (input.search) {
    const searchPattern = `%${input.search}%`
    conditions.push(
      or(
        like(musicFiles.title, searchPattern),
        like(musicFiles.artist, searchPattern),
        like(musicFiles.album, searchPattern),
        like(musicFiles.filename, searchPattern),
      ),
    )
  }

  let query = db.select().from(musicFiles)

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query
  }

  if (input.limit) {
    query = query.limit(input.limit) as typeof query
  }

  if (input.offset) {
    query = query.offset(input.offset) as typeof query
  }

  const rows = query.all()

  return rows.map((row) => ({
    id: row.id,
    folderId: row.folderId,
    path: row.path,
    filename: row.filename,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    year: row.year,
    trackNumber: row.trackNumber,
    duration: row.duration,
    format: row.format as MusicFile['format'],
    fileSize: row.fileSize,
    lastModified: row.lastModified ? row.lastModified.getTime() : null,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }))
}

export function getFileById(id: number): MusicFile | null {
  const db = getDatabase()

  const row = db.select().from(musicFiles).where(eq(musicFiles.id, id)).get()

  if (!row) return null

  return {
    id: row.id,
    folderId: row.folderId,
    path: row.path,
    filename: row.filename,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    year: row.year,
    trackNumber: row.trackNumber,
    duration: row.duration,
    format: row.format as MusicFile['format'],
    fileSize: row.fileSize,
    lastModified: row.lastModified ? row.lastModified.getTime() : null,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

export function getFilesWithFolder(
  input: GetFilesInput = {},
): MusicFileWithFolder[] {
  const db = getDatabase()

  const conditions = []

  if (input.folderId) {
    conditions.push(eq(musicFiles.folderId, input.folderId))
  }

  if (input.search) {
    const searchPattern = `%${input.search}%`
    conditions.push(
      or(
        like(musicFiles.title, searchPattern),
        like(musicFiles.artist, searchPattern),
        like(musicFiles.album, searchPattern),
        like(musicFiles.filename, searchPattern),
      ),
    )
  }

  let query = db
    .select({
      file: musicFiles,
      folder: {
        id: musicFolders.id,
        name: musicFolders.name,
        path: musicFolders.path,
      },
    })
    .from(musicFiles)
    .innerJoin(musicFolders, eq(musicFiles.folderId, musicFolders.id))

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query
  }

  if (input.limit) {
    query = query.limit(input.limit) as typeof query
  }

  if (input.offset) {
    query = query.offset(input.offset) as typeof query
  }

  const rows = query.all()

  return rows.map((row) => ({
    id: row.file.id,
    folderId: row.file.folderId,
    path: row.file.path,
    filename: row.file.filename,
    title: row.file.title,
    artist: row.file.artist,
    album: row.file.album,
    genre: row.file.genre,
    year: row.file.year,
    trackNumber: row.file.trackNumber,
    duration: row.file.duration,
    format: row.file.format as MusicFile['format'],
    fileSize: row.file.fileSize,
    lastModified: row.file.lastModified
      ? row.file.lastModified.getTime()
      : null,
    createdAt: row.file.createdAt.getTime(),
    updatedAt: row.file.updatedAt.getTime(),
    folder: row.folder,
  }))
}

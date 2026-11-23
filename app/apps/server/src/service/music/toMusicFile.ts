import type { MusicFile } from './types'
import type { musicFiles } from '../../db/schema'

type MusicFileRow = typeof musicFiles.$inferSelect

export function toMusicFile(row: MusicFileRow): MusicFile {
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
    playCount: row.playCount,
    lastPlayedAt: row.lastPlayedAt ? row.lastPlayedAt.getTime() : null,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

import { asc, eq } from 'drizzle-orm'

import type {
  MusicFile,
  MusicPlaylist,
  MusicPlaylistItem,
  MusicPlaylistWithItems,
} from './types'
import { getDatabase } from '../../db'
import { musicFiles, musicPlaylistItems, musicPlaylists } from '../../db/schema'

export function getPlaylists(): MusicPlaylist[] {
  const db = getDatabase()

  const rows = db.select().from(musicPlaylists).all()

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: row.itemCount,
    totalDuration: row.totalDuration,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }))
}

export function getPlaylistById(id: number): MusicPlaylistWithItems | null {
  const db = getDatabase()

  const playlist = db
    .select()
    .from(musicPlaylists)
    .where(eq(musicPlaylists.id, id))
    .get()

  if (!playlist) return null

  const items = db
    .select({
      item: musicPlaylistItems,
      file: musicFiles,
    })
    .from(musicPlaylistItems)
    .innerJoin(musicFiles, eq(musicPlaylistItems.fileId, musicFiles.id))
    .where(eq(musicPlaylistItems.playlistId, id))
    .orderBy(asc(musicPlaylistItems.sortOrder))
    .all()

  const mappedItems: MusicPlaylistItem[] = items.map((row) => ({
    id: row.item.id,
    playlistId: row.item.playlistId,
    fileId: row.item.fileId,
    sortOrder: row.item.sortOrder,
    createdAt: row.item.createdAt.getTime(),
    file: {
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
    },
  }))

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    itemCount: playlist.itemCount,
    totalDuration: playlist.totalDuration,
    createdAt: playlist.createdAt.getTime(),
    updatedAt: playlist.updatedAt.getTime(),
    items: mappedItems,
  }
}

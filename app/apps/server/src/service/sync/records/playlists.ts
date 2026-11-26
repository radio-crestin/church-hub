import { idByUuid } from './idByUuid'
import { getRawDatabase } from '../../../db'
import type { LibraryPlaylist, LibraryPlaylistItem } from '../types'

interface PlaylistRow {
  id: number
  uuid: string
  name: string
  description: string | null
  unresolved_items: string | null
  created_at: number
  updated_at: number
}

/**
 * Playlists with their items, named by file path: the items whose file is
 * on this device, plus the ones kept from other devices (unresolved_items),
 * so an edit here doesn't drop them for everyone.
 */
export function serializePlaylists(): LibraryPlaylist[] {
  const db = getRawDatabase()
  const items = db
    .query<LibraryPlaylistItem & { playlist_id: number }, []>(
      `SELECT i.playlist_id, f.path, f.title, f.artist, f.duration,
              i.sort_order AS sortOrder
         FROM music_playlist_items i JOIN music_files f ON f.id = i.file_id`,
    )
    .all()
  return db
    .query<PlaylistRow, []>(
      `SELECT id, uuid, name, description, unresolved_items, created_at, updated_at
         FROM music_playlists WHERE uuid != ''`,
    )
    .all()
    .map((row) => ({
      uuid: row.uuid,
      name: row.name,
      description: row.description,
      items: [
        ...items
          .filter((item) => item.playlist_id === row.id)
          .map(({ playlist_id: _, ...item }) => item),
        ...(JSON.parse(row.unresolved_items ?? '[]') as LibraryPlaylistItem[]),
      ].sort((a, b) => a.sortOrder - b.sortOrder),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
}

export function upsertPlaylist(playlist: LibraryPlaylist): number | null {
  const db = getRawDatabase()
  const fileByPath = db.query<
    { id: number; duration: number | null },
    [string]
  >('SELECT id, duration FROM music_files WHERE path = ?')
  const resolved: { fileId: number; duration: number; sortOrder: number }[] = []
  const unresolved: LibraryPlaylistItem[] = []
  for (const item of playlist.items) {
    const file = fileByPath.get(item.path)
    if (file) {
      resolved.push({
        fileId: file.id,
        duration: file.duration ?? 0,
        sortOrder: item.sortOrder,
      })
    } else {
      unresolved.push(item)
    }
  }

  db.query(
    `INSERT INTO music_playlists (
       uuid, name, description, item_count, total_duration, unresolved_items,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (uuid) DO UPDATE SET
       name = excluded.name, description = excluded.description,
       item_count = excluded.item_count,
       total_duration = excluded.total_duration,
       unresolved_items = excluded.unresolved_items,
       updated_at = excluded.updated_at`,
  ).run(
    playlist.uuid,
    playlist.name,
    playlist.description,
    resolved.length,
    resolved.reduce((total, item) => total + item.duration, 0),
    unresolved.length > 0 ? JSON.stringify(unresolved) : null,
    playlist.createdAt,
    playlist.updatedAt,
  )
  const playlistId = idByUuid('music_playlists', playlist.uuid)
  if (playlistId === null) return null

  db.query('DELETE FROM music_playlist_items WHERE playlist_id = ?').run(
    playlistId,
  )
  const insert = db.query(
    'INSERT INTO music_playlist_items (playlist_id, file_id, sort_order) VALUES (?, ?, ?)',
  )
  for (const item of resolved)
    insert.run(playlistId, item.fileId, item.sortOrder)
  return playlistId
}

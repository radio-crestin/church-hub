import { PC_API_ORIGIN } from './pcApiOrigin'
import type { ChurchSong, SongRow } from './types'

/** The first songs by title, as the list shows them before a search. */
export const PC_PAGE_SIZE = 200

async function getPc<T>(path: string): Promise<T> {
  const response = await fetch(`${PC_API_ORIGIN}${path}`)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return ((await response.json()) as { data: T }).data
}

/**
 * The church's songs by title from the PC's live API (GET /api/songs), and
 * how many it has: a page, since a church's library can hold thousands.
 */
export async function loadPcSongPage(): Promise<{
  rows: SongRow[]
  total: number
}> {
  const page = await getPc<{
    songs: Array<{ id: number; title: string; author: string | null }>
    total: number
  }>(`/api/songs?limit=${PC_PAGE_SIZE}&sortBy=title`)
  return {
    rows: page.songs.map(({ id, title, author }) => ({
      key: String(id),
      title,
      author,
    })),
    total: page.total,
  }
}

/** The PC's own search (GET /api/songs/search): titles and lyrics. */
export async function searchPcSongs(query: string): Promise<SongRow[]> {
  const results = await getPc<Array<{ id: number; title: string }>>(
    `/api/songs/search?q=${encodeURIComponent(query)}`,
  )
  return results.map(({ id, title }) => ({
    key: String(id),
    title,
    author: null,
  }))
}

/** One song with its slides, as the PC has it now (GET /api/songs/:id). */
export async function loadPcSong(id: string): Promise<ChurchSong> {
  return getPc<ChurchSong>(`/api/songs/${encodeURIComponent(id)}`)
}

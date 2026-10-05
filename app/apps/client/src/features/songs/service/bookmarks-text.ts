import { fetcher } from '../../../utils/fetcher'

/** A line of the Marcaje text that names no song in the library. */
export interface SongBookmarksTextError {
  line: number
  content: string
  reason: 'song_not_found'
}

/** `applied` is false when any line failed: then nothing changed. */
export interface SongBookmarksTextResult {
  applied: boolean
  songs: number
  notes: number
  errors: SongBookmarksTextError[]
}

/** The Marcaje list as Markdown, one line per song (`## Title {#song-12}`) or note (`> note`). */
export async function getBookmarksText(): Promise<string> {
  const response = await fetcher<{ data: string }>('/api/song-bookmarks/text')
  return response.data ?? ''
}

/** Makes the Marcaje list exactly what the text says, or nothing when a song is unknown. */
export async function replaceBookmarksFromText(
  text: string,
): Promise<SongBookmarksTextResult> {
  const response = await fetcher<{ data: SongBookmarksTextResult }>(
    '/api/song-bookmarks/text',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
  )
  return response.data ?? { applied: false, songs: 0, notes: 0, errors: [] }
}

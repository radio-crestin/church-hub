import { SyncError } from '../sync/SyncError'

const MAX_TITLE = 200
const MAX_XML = 200 * 1024
const MAX_NOTE = 1000
const MAX_CHURCH_NAME = 200
/** Songs in one submission: a whole category at most. */
export const MAX_SONGS = 500

/** One song a church sends: its OpenSong file and its id there. */
export interface SubmittedSongInput {
  title: string
  xml: string
  sourceSongId: string | null
}

/** What a church sends: one or more songs, and who it is from. */
export interface SubmissionInput {
  songs: SubmittedSongInput[]
  churchName: string | null
  note: string | null
}

function invalid(message: string): never {
  throw new SyncError(400, 'invalid_request', message)
}

function optionalText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, max)
    : null
}

function parseSong(value: unknown): SubmittedSongInput {
  const song = (value ?? {}) as Record<string, unknown>
  const title = typeof song.title === 'string' ? song.title.trim() : ''
  const xml = typeof song.xml === 'string' ? song.xml.trim() : ''
  if (!title || title.length > MAX_TITLE) invalid('Each song needs a title')
  if (!/^(<\?xml[^>]*>\s*)?<song[\s>]/.test(xml) || xml.length > MAX_XML) {
    invalid('Each song must be an OpenSong song under 200 KB')
  }
  return { title, xml, sourceSongId: optionalText(song.sourceSongId, 64) }
}

/** A submission's body, checked; 400 invalid_request otherwise. */
export function parseSubmission(body: unknown): SubmissionInput {
  const input = (body ?? {}) as Record<string, unknown>
  if (
    !Array.isArray(input.songs) ||
    input.songs.length === 0 ||
    input.songs.length > MAX_SONGS
  ) {
    invalid(`songs must hold 1 to ${MAX_SONGS} songs`)
  }
  return {
    songs: input.songs.map(parseSong),
    churchName: optionalText(input.churchName, MAX_CHURCH_NAME),
    note: optionalText(input.note, MAX_NOTE),
  }
}

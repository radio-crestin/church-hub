import { SyncError } from '../sync/SyncError'

const MAX_TITLE = 200
const MAX_XML = 200 * 1024
const MAX_NOTE = 1000
const MAX_CHURCH_NAME = 200

/** What a church sends: the song's OpenSong file and who it is from. */
export interface SubmissionInput {
  title: string
  xml: string
  sourceSongId: string | null
  churchName: string | null
  note: string | null
}

function optionalText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, max)
    : null
}

/** A submission's body, checked; 400 invalid_request otherwise. */
export function parseSubmission(body: unknown): SubmissionInput {
  const input = (body ?? {}) as Record<string, unknown>
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const xml = typeof input.xml === 'string' ? input.xml.trim() : ''
  if (!title || title.length > MAX_TITLE) {
    throw new SyncError(400, 'invalid_request', 'A title is required')
  }
  if (!/^(<\?xml[^>]*>\s*)?<song[\s>]/.test(xml) || xml.length > MAX_XML) {
    throw new SyncError(
      400,
      'invalid_request',
      'xml must be an OpenSong song under 200 KB'
    )
  }
  return {
    title,
    xml,
    sourceSongId: optionalText(input.sourceSongId, 64),
    churchName: optionalText(input.churchName, MAX_CHURCH_NAME),
    note: optionalText(input.note, MAX_NOTE),
  }
}

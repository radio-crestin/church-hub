/** One word of a line, with the chord played on it. */
export interface SharedSongWord {
  word: string
  chord?: string
}

/** A song shared by a link (the sync service's GET /sync/song-links/:id). */
export interface SharedSong {
  churchId: string
  songUuid: string
  title: string
  author: string | null
  copyright: string | null
  keyLine: string | null
  slides: { label: string | null; lines: SharedSongWord[][] }[]
}

export type SharedSongResult =
  | { kind: 'found'; song: SharedSong }
  | { kind: 'notFound' }
  | { kind: 'offline' }

const BASE = import.meta.env.BASE_URL
const SONG_PATH = /^song\/([0-9a-f]{32})\/?$/

/** The link id when the page was opened as a song's link. */
export function sharedSongLinkId(): string | null {
  const { pathname } = window.location
  if (!pathname.startsWith(BASE)) return null
  return pathname.slice(BASE.length).match(SONG_PATH)?.[1] ?? null
}

/** The song behind a link, from the sync service the link names. */
export async function fetchSharedSong(
  serviceUrl: string,
  linkId: string,
): Promise<SharedSongResult> {
  try {
    const response = await fetch(
      `${serviceUrl.replace(/\/+$/, '')}/sync/song-links/${linkId}`,
    )
    if (response.status === 404) return { kind: 'notFound' }
    if (!response.ok) return { kind: 'offline' }
    return { kind: 'found', song: (await response.json()) as SharedSong }
  } catch {
    return { kind: 'offline' }
  }
}

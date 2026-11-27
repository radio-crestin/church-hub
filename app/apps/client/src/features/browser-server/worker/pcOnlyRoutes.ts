/**
 * What only the church PC can do: its hardware (OBS, the mixer, MIDI,
 * audio, screen share), its files (music, backups, the database file, logs,
 * PowerPoint conversion), its network (remote access, LAN addresses), live
 * translation and the song sources' bucket publishing. In a browser these
 * routes answer 503 `needs_church_pc`, and the app hides what leads to them.
 */
const PC_ONLY_PREFIXES = [
  '/api/backup',
  '/api/convert',
  '/api/database',
  '/api/live-translation',
  '/api/livestream',
  '/api/logs',
  '/api/midi',
  '/api/music',
  '/api/network',
  '/api/remote-access',
  '/api/screen-links/endpoints',
  '/api/screen-share',
  '/api/song-sources',
]

const NEEDS_CHURCH_PC = 'needs_church_pc'

export function needsChurchPc(pathname: string): boolean {
  return PC_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function needsChurchPcResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'This needs the church computer',
      code: NEEDS_CHURCH_PC,
    }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  )
}

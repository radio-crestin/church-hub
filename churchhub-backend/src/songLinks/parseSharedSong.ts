import { SyncError } from '../sync/SyncError'
import type { SharedSongInput, SharedSongSlide, SharedSongWord } from './types'

const MAX_SLIDES = 200
const MAX_LINES = 60
const MAX_WORDS = 80
const MAX_TEXT = 200

const text = (value: unknown, max = MAX_TEXT): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null

function parseWord(value: unknown): SharedSongWord | null {
  const item = value as { word?: unknown; chord?: unknown } | null
  const word = text(item?.word, 100)
  if (!word) return null
  const chord = text(item?.chord, 20)
  return chord ? { word, chord } : { word }
}

function parseSlide(value: unknown): SharedSongSlide | null {
  const slide = value as { label?: unknown; lines?: unknown } | null
  if (!Array.isArray(slide?.lines) || slide.lines.length > MAX_LINES) {
    return null
  }
  const lines: SharedSongWord[][] = []
  for (const line of slide.lines) {
    if (!Array.isArray(line) || line.length > MAX_WORDS) return null
    lines.push(line.map(parseWord).filter((word) => word !== null))
  }
  return { label: text(slide.label, 40), lines }
}

/** The song a church shares; 400 when it is not one. */
export function parseSharedSong(body: unknown): SharedSongInput {
  const song = body as Record<string, unknown> | null
  const title = text(song?.title)
  const slides = Array.isArray(song?.slides) ? song.slides : null
  if (!title || !slides || slides.length > MAX_SLIDES) {
    throw new SyncError(400, 'invalid_song', 'A title and its slides are required')
  }
  const parsed = slides.map(parseSlide)
  if (parsed.some((slide) => slide === null)) {
    throw new SyncError(400, 'invalid_song', 'A slide is not valid')
  }
  return {
    title,
    author: text(song?.author),
    copyright: text(song?.copyright),
    keyLine: text(song?.keyLine, 40),
    slides: parsed as SharedSongSlide[],
  }
}

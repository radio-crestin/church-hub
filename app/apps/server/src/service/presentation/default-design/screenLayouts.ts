import type { Box, TextSlot } from './designPrimitives'
import type { ScreenType } from '../types'

/**
 * Where each element of the factory design sits on each screen type. One
 * shared margin per screen keeps every content type aligned to the same edges,
 * so switching from a song to a verse never makes the text jump sideways.
 */
export interface ScreenLayout {
  /** Transparent overlay (livestream) or solid black projection. */
  transparent: boolean
  /** Text shadow: keeps text readable over video and background images. */
  shadow: boolean
  lyrics: TextSlot
  /** Lyrics on the last slide, kept clear of the "Amin". */
  lastSlideLyrics: TextSlot
  songKey: TextSlot
  amen: TextSlot
  reference: TextSlot
  scripture: TextSlot
  announcement: TextSlot
  personLabel: TextSlot
  youthReference: TextSlot
  youthScripture: TextSlot
  clock: TextSlot
  /** Clock shown with content (stage: the time is for the people on stage). */
  clockWithContent: boolean
  /** Clock shown when nothing is presented. */
  clockWhenIdle: boolean
}

function box(top: number, right: number, bottom: number, left: number): Box {
  return { top, right, bottom, left }
}

/** Main projection, 16:9: centred lyrics, scripture under a gold reference. */
const primary: ScreenLayout = {
  transparent: false,
  shadow: true,
  lyrics: { box: box(11, 6, 13, 6), maxFontSize: 110, alignment: 'center' },
  lastSlideLyrics: {
    box: box(11, 6, 13, 6),
    maxFontSize: 110,
    alignment: 'center',
  },
  songKey: { box: box(3, 50, 90, 6), maxFontSize: 52, alignment: 'left' },
  amen: { box: box(88, 6, 3, 6), maxFontSize: 52, alignment: 'center' },
  reference: { box: box(6, 6, 85, 6), maxFontSize: 64, alignment: 'left' },
  scripture: {
    box: box(17, 6, 8, 6),
    maxFontSize: 110,
    alignment: 'left',
    verticalAlignment: 'top',
  },
  announcement: {
    box: box(10, 8, 10, 8),
    maxFontSize: 100,
    alignment: 'center',
  },
  personLabel: { box: box(6, 50, 88, 6), maxFontSize: 48, alignment: 'left' },
  youthReference: {
    box: box(12, 6, 79, 6),
    maxFontSize: 64,
    alignment: 'left',
  },
  youthScripture: {
    box: box(23, 6, 8, 6),
    maxFontSize: 104,
    alignment: 'left',
    verticalAlignment: 'top',
  },
  clock: { box: box(3, 3, 89, 75), maxFontSize: 56, alignment: 'right' },
  clockWithContent: false,
  clockWhenIdle: false,
}

/**
 * Stage / confidence monitor: big left-aligned text read at a glance, a top
 * band for the clock and labels, and the bottom 22% left free for the
 * "next slide" strip when it is switched on.
 */
const stage: ScreenLayout = {
  transparent: false,
  shadow: false,
  lyrics: {
    box: box(13, 4, 24, 4),
    maxFontSize: 120,
    alignment: 'left',
    verticalAlignment: 'top',
  },
  lastSlideLyrics: {
    box: box(13, 4, 24, 4),
    maxFontSize: 120,
    alignment: 'left',
    verticalAlignment: 'top',
  },
  songKey: { box: box(3, 40, 89, 4), maxFontSize: 52, alignment: 'left' },
  amen: { box: box(3, 40, 89, 4), maxFontSize: 52, alignment: 'left' },
  reference: { box: box(3, 30, 89, 4), maxFontSize: 56, alignment: 'left' },
  scripture: {
    box: box(13, 4, 24, 4),
    maxFontSize: 100,
    alignment: 'left',
    verticalAlignment: 'top',
  },
  announcement: {
    box: box(13, 4, 24, 4),
    maxFontSize: 100,
    alignment: 'center',
  },
  personLabel: { box: box(3, 30, 89, 40), maxFontSize: 44, alignment: 'left' },
  youthReference: {
    box: box(3, 62, 89, 4),
    maxFontSize: 56,
    alignment: 'left',
  },
  youthScripture: {
    box: box(13, 4, 24, 4),
    maxFontSize: 100,
    alignment: 'left',
    verticalAlignment: 'top',
  },
  clock: { box: box(2, 3, 89, 70), maxFontSize: 72, alignment: 'right' },
  clockWithContent: true,
  clockWhenIdle: true,
}

/**
 * Livestream overlay (1080×420, transparent, keyed over the camera in OBS or
 * NDI): shadowed text, no song key — the stream audience reads the words, the
 * key is for the musicians in the room.
 */
const livestream: ScreenLayout = {
  transparent: true,
  shadow: true,
  lyrics: { box: box(8, 5, 8, 5), maxFontSize: 64, alignment: 'center' },
  lastSlideLyrics: {
    box: box(8, 5, 8, 5),
    maxFontSize: 64,
    alignment: 'center',
  },
  songKey: {
    box: box(4, 50, 84, 5),
    maxFontSize: 28,
    alignment: 'left',
    hidden: true,
  },
  amen: {
    box: box(84, 5, 4, 5),
    maxFontSize: 30,
    alignment: 'center',
    hidden: true,
  },
  reference: { box: box(7, 5, 78, 5), maxFontSize: 34, alignment: 'left' },
  scripture: {
    box: box(25, 5, 7, 5),
    maxFontSize: 56,
    alignment: 'left',
    verticalAlignment: 'top',
  },
  announcement: { box: box(8, 5, 8, 5), maxFontSize: 60, alignment: 'center' },
  personLabel: { box: box(7, 5, 78, 50), maxFontSize: 28, alignment: 'right' },
  youthReference: {
    box: box(7, 50, 78, 5),
    maxFontSize: 34,
    alignment: 'left',
  },
  youthScripture: {
    box: box(25, 5, 7, 5),
    maxFontSize: 56,
    alignment: 'left',
    verticalAlignment: 'top',
  },
  clock: { box: box(4, 3, 80, 75), maxFontSize: 32, alignment: 'right' },
  clockWithContent: false,
  clockWhenIdle: false,
}

/** Kiosk / lobby portrait display (1080×1920): large text, clock when idle. */
const kiosk: ScreenLayout = {
  transparent: false,
  shadow: true,
  lyrics: { box: box(10, 7, 10, 7), maxFontSize: 96, alignment: 'center' },
  lastSlideLyrics: {
    box: box(10, 7, 10, 7),
    maxFontSize: 96,
    alignment: 'center',
  },
  songKey: { box: box(4, 40, 91, 7), maxFontSize: 60, alignment: 'left' },
  amen: { box: box(91, 7, 4, 7), maxFontSize: 60, alignment: 'center' },
  reference: { box: box(8, 7, 86, 7), maxFontSize: 64, alignment: 'left' },
  scripture: {
    box: box(16, 7, 8, 7),
    maxFontSize: 88,
    alignment: 'left',
    verticalAlignment: 'top',
  },
  announcement: {
    box: box(10, 8, 10, 8),
    maxFontSize: 96,
    alignment: 'center',
  },
  personLabel: { box: box(6, 7, 90, 7), maxFontSize: 52, alignment: 'left' },
  youthReference: {
    box: box(10.5, 7, 83, 7),
    maxFontSize: 64,
    alignment: 'left',
  },
  youthScripture: {
    box: box(19, 7, 8, 7),
    maxFontSize: 84,
    alignment: 'left',
    verticalAlignment: 'top',
  },
  clock: { box: box(42, 8, 46, 8), maxFontSize: 220, alignment: 'center' },
  clockWithContent: false,
  clockWhenIdle: true,
}

export const SCREEN_LAYOUTS: Record<ScreenType, ScreenLayout> = {
  primary,
  stage,
  livestream,
  kiosk,
}

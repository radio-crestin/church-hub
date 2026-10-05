import { boxPlacement, COLORS, FONTS, textElement } from './designPrimitives'
import { SCREEN_LAYOUTS, type ScreenLayout } from './screenLayouts'
import type { ContentType, ScreenType } from '../types'

function background(layout: ScreenLayout) {
  return layout.transparent
    ? { type: 'transparent', opacity: 1 }
    : { type: 'color', color: COLORS.background, opacity: 1 }
}

function songElements(layout: ScreenLayout) {
  const shadow = layout.shadow
  return {
    mainText: textElement(
      layout.lyrics,
      { bold: true, shadow },
      { padding: 20 },
    ),
    songKey: textElement(layout.songKey, {
      fontFamily: FONTS.title,
      bold: true,
      color: COLORS.accent,
      autoScale: false,
      shadow,
    }),
    amen: textElement(layout.amen, {
      fontFamily: FONTS.title,
      bold: true,
      color: COLORS.accent,
      autoScale: false,
      shadow,
    }),
  }
}

function referenceStyle(layout: ScreenLayout) {
  return {
    fontFamily: FONTS.title,
    bold: true,
    color: COLORS.accent,
    shadow: layout.shadow,
  }
}

function songConfig(layout: ScreenLayout, screenType: ScreenType) {
  return {
    background: background(layout),
    ...songElements(layout),
    clockEnabled: layout.clockWithContent,
    // The stream audience doesn't need the song key (gama).
    ...(screenType === 'livestream' ? { displayKeyLine: false } : {}),
  }
}

function songFirstSlideConfig(layout: ScreenLayout) {
  const { mainText, songKey } = songElements(layout)
  return {
    background: background(layout),
    mainText,
    songKey,
    clockEnabled: layout.clockWithContent,
  }
}

function songLastSlideConfig(layout: ScreenLayout) {
  const { amen } = songElements(layout)
  return {
    background: background(layout),
    mainText: textElement(
      layout.lastSlideLyrics,
      { bold: true, shadow: layout.shadow },
      { padding: 20 },
    ),
    amen,
    clockEnabled: layout.clockWithContent,
  }
}

function bibleConfig(layout: ScreenLayout) {
  return {
    background: background(layout),
    referenceText: textElement(layout.reference, referenceStyle(layout)),
    contentText: textElement(
      layout.scripture,
      { bold: true, lineHeight: 1.25, shadow: layout.shadow },
      { padding: 20 },
    ),
    clockEnabled: layout.clockWithContent,
    includeReferenceInContent: false,
    referenceWrapperStyle: 'none',
  }
}

function announcementConfig(layout: ScreenLayout) {
  return {
    background: background(layout),
    mainText: textElement(
      layout.announcement,
      {
        fontFamily: FONTS.title,
        bold: true,
        lineHeight: 1.25,
        shadow: layout.shadow,
      },
      { padding: 20 },
    ),
    clockEnabled: layout.clockWithContent,
  }
}

function verseteTineriConfig(layout: ScreenLayout) {
  return {
    background: background(layout),
    personLabel: textElement(layout.personLabel, {
      italic: true,
      color: COLORS.muted,
      autoScale: false,
      shadow: layout.shadow,
    }),
    referenceText: textElement(layout.youthReference, referenceStyle(layout)),
    contentText: textElement(
      layout.youthScripture,
      { bold: true, lineHeight: 1.25, shadow: layout.shadow },
      { padding: 20 },
    ),
    clockEnabled: layout.clockWithContent,
  }
}

function screenShareConfig() {
  return {
    background: { type: 'color', color: COLORS.background, opacity: 1 },
    videoElement: {
      ...boxPlacement({ top: 0, right: 0, bottom: 0, left: 0 }),
      objectFit: 'contain',
    },
    clockEnabled: false,
  }
}

/**
 * The factory design of one content type on one screen type: what a new
 * screen (and a fresh install) starts with. Users' saved designs never pass
 * through here; it only fills what a screen has not stored.
 */
export function getDefaultContentConfig(
  contentType: ContentType,
  screenType: ScreenType = 'primary',
): Record<string, unknown> {
  const layout = SCREEN_LAYOUTS[screenType] ?? SCREEN_LAYOUTS.primary
  switch (contentType) {
    case 'song':
      return songConfig(layout, screenType)
    case 'song_first_slide':
      return songFirstSlideConfig(layout)
    case 'song_last_slide':
      return songLastSlideConfig(layout)
    case 'bible':
    case 'bible_passage':
      return bibleConfig(layout)
    case 'announcement':
      return announcementConfig(layout)
    case 'versete_tineri':
      return verseteTineriConfig(layout)
    case 'empty':
      return {
        background: background(layout),
        clockEnabled: layout.clockWhenIdle,
      }
    case 'screen_share':
      return screenShareConfig()
  }
}

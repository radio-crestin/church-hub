import type {
  AnimationConfig,
  AnimationType,
  ContentType,
  ScreenBackgroundConfig,
  ScreenWithConfigs,
  TextElementConfig,
} from '../../../types'
import { FACTORY_TRANSITIONS } from '../../../utils/factoryTransitions'
import { TYPEWRITER_DURATION } from '../../../utils/typewriterDuration'

/** The slide's own words: lyrics, the verse, an announcement. */
const TEXT_ELEMENTS = ['mainText', 'contentText'] as const
/** What goes with them: the reference, a song's key, title and Amen, a name. */
const ACCENT_ELEMENTS = [
  'referenceText',
  'songKey',
  'amen',
  'songTitle',
  'personLabel',
] as const

/** Songs never type: the congregation sings the words at once. */
const SONG_KINDS = new Set(['song', 'song_first_slide', 'song_last_slide'])

const TYPEWRITER: AnimationConfig = {
  type: 'typewriter',
  duration: TYPEWRITER_DURATION.default,
  delay: 0,
  easing: 'linear',
}

type ElementName =
  | (typeof TEXT_ELEMENTS)[number]
  | (typeof ACCENT_ELEMENTS)[number]

/** A theme's look across all its slides, as the Design panel shows it. */
export interface ThemeDesign {
  textColor: string
  accentColor: string
  textFont: string
  accentFont: string
  shadow: boolean
  background: ScreenBackgroundConfig
  transition: AnimationType
  transitionMs: number
  /** The verses and announcements type themselves in. */
  typewriter: boolean
}

/** One change from the Design panel, applied to every slide. */
export type ThemeDesignChange = Partial<ThemeDesign>

type Layout = Record<string, unknown> & { background?: ScreenBackgroundConfig }

function element(layout: Layout, name: ElementName) {
  return layout[name] as TextElementConfig | undefined
}

/** Read from the song (the slide shown most) and the Bible verse. */
export function readThemeDesign(screen: ScreenWithConfigs): ThemeDesign {
  const song = screen.contentConfigs.song as unknown as Layout
  const bible = screen.contentConfigs.bible as unknown as Layout
  const text = element(song, 'mainText')?.style
  const accent = element(bible, 'referenceText')?.style
  const transition = element(song, 'mainText')?.slideTransitionIn
  return {
    textColor: text?.color ?? '#ffffff',
    accentColor: accent?.color ?? '#ffffff',
    textFont: text?.fontFamily ?? 'Fira Sans',
    accentFont: accent?.fontFamily ?? 'Fira Sans',
    shadow: text?.shadow ?? false,
    background: song.background ?? {
      type: 'color',
      color: '#000000',
      opacity: 1,
    },
    transition: transition?.type ?? 'fade',
    transitionMs: transition?.duration ?? 300,
    typewriter:
      element(bible, 'contentText')?.slideTransitionIn?.type === 'typewriter',
  }
}

function restyleElement(
  config: TextElementConfig,
  change: ThemeDesignChange,
  role: 'text' | 'accent',
): TextElementConfig {
  const color = role === 'text' ? change.textColor : change.accentColor
  const fontFamily = role === 'text' ? change.textFont : change.accentFont
  const style = {
    ...config.style,
    ...(color !== undefined && { color }),
    ...(fontFamily !== undefined && { fontFamily }),
    ...(change.shadow !== undefined && { shadow: change.shadow }),
  }
  if (change.transition === undefined && change.transitionMs === undefined) {
    return { ...config, style }
  }
  const transition = (current?: AnimationConfig): AnimationConfig => ({
    delay: 0,
    easing: 'ease-in-out',
    ...current,
    type: change.transition ?? current?.type ?? 'fade',
    duration: change.transitionMs ?? current?.duration ?? 300,
  })
  const typed = config.slideTransitionIn?.type === 'typewriter'
  return {
    ...config,
    style,
    // A text that types keeps typing; the transition is how it leaves.
    slideTransitionIn: typed
      ? config.slideTransitionIn
      : transition(config.slideTransitionIn),
    slideTransitionOut: transition(config.slideTransitionOut),
  }
}

/** The text typed in, or back to the theme's transition. */
function withTypewriter(
  config: TextElementConfig,
  typewriter: boolean,
): TextElementConfig {
  return {
    ...config,
    animationIn: typewriter ? TYPEWRITER : FACTORY_TRANSITIONS.animationIn,
    slideTransitionIn: typewriter
      ? TYPEWRITER
      : (config.slideTransitionOut ?? FACTORY_TRANSITIONS.slideTransitionIn),
  }
}

/**
 * The theme with one Design change made on every slide type: its colours,
 * fonts, shadow and transition on every text, and its background on every
 * slide and as the screen's default. What a slide sets beyond these (where
 * its boxes sit, sizes, alignment) stays.
 */
export function applyThemeDesign(
  screen: ScreenWithConfigs,
  change: ThemeDesignChange,
): ScreenWithConfigs {
  const contentConfigs = Object.fromEntries(
    Object.entries(screen.contentConfigs).map(([kind, config]) => {
      const layout = { ...(config as unknown as Layout) }
      for (const [names, role] of [
        [TEXT_ELEMENTS, 'text'],
        [ACCENT_ELEMENTS, 'accent'],
      ] as const) {
        for (const name of names) {
          const current = element(layout, name)
          if (!current) continue
          const restyled = restyleElement(current, change, role)
          const types =
            change.typewriter !== undefined &&
            role === 'text' &&
            !SONG_KINDS.has(kind)
          layout[name] = types
            ? withTypewriter(restyled, change.typewriter as boolean)
            : restyled
        }
      }
      if (change.background) layout.background = change.background
      return [kind, layout]
    }),
  ) as unknown as Record<ContentType, unknown>

  return {
    ...screen,
    contentConfigs: contentConfigs as ScreenWithConfigs['contentConfigs'],
    globalSettings: change.background
      ? {
          ...screen.globalSettings,
          defaultBackground: change.background,
        }
      : screen.globalSettings,
  }
}

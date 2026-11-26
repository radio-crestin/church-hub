/**
 * A presentation's "Slides" item (CH-183): a deck of our own PowerPoint-like
 * slides, stored as the item's `itemConfig`. Mirrors the server's
 * service/slides-deck/types.ts (the enum lists are what the server accepts).
 */

export const DECK_SLIDE_KINDS = [
  'blank',
  'title',
  'title_text',
  'picture',
  'video',
] as const
export const DECK_TRANSITION_EFFECTS = [
  'none',
  'fade',
  'push',
  'wipe',
  'cover',
  'split',
  'zoom',
] as const
export const DECK_DIRECTIONS = ['left', 'right', 'up', 'down'] as const
export const DECK_FITS = ['cover', 'contain'] as const
export const DECK_IMAGE_FITS = ['cover', 'contain', 'fill'] as const
export const DECK_VERTICAL_ALIGNS = ['top', 'middle', 'bottom'] as const
export const DECK_SHAPES = [
  'rect',
  'roundRect',
  'ellipse',
  'line',
  'triangle',
] as const
export const DECK_FALLBACK_REASONS = [
  'smartart',
  'chart',
  'ole',
  'other',
] as const
export const DECK_ANIMATION_KINDS = ['entrance', 'emphasis', 'exit'] as const
export const DECK_ANIMATION_EFFECTS = [
  'appear',
  'fade',
  'fly',
  'wipe',
  'zoom',
  'split',
  'rise_up',
  'grow_turn',
  'grow_shrink',
  'spin',
  'transparency',
  'pulse',
] as const
export const DECK_TRIGGERS = [
  'click',
  'with_previous',
  'after_previous',
] as const

export type DeckSlideKind = (typeof DECK_SLIDE_KINDS)[number]
export type DeckTransitionEffect = (typeof DECK_TRANSITION_EFFECTS)[number]
export type DeckDirection = (typeof DECK_DIRECTIONS)[number]
export type DeckShape = (typeof DECK_SHAPES)[number]
export type DeckAnimationKind = (typeof DECK_ANIMATION_KINDS)[number]
export type DeckAnimationEffect = (typeof DECK_ANIMATION_EFFECTS)[number]
export type DeckTrigger = (typeof DECK_TRIGGERS)[number]

export interface SlideDeck {
  /** The design size the slides are laid out on (default 1920×1080). */
  width: number
  height: number
  slides: DeckSlide[]
  /** Where it came from, when imported. */
  source?: { kind: 'pptx'; fileName: string }
}

export type DeckBackground =
  | { type: 'color'; color: string }
  | {
      type: 'image' | 'video'
      mediaId: string
      fit?: (typeof DECK_FITS)[number]
    }

export interface DeckTransition {
  effect: DeckTransitionEffect
  direction?: DeckDirection
  durationMs: number
}

export interface DeckSlide {
  id: string
  kind: DeckSlideKind
  background?: DeckBackground
  /** Played as the slide comes in, over the slide before it. */
  transition?: DeckTransition
  /** How long each of its steps stays up while the presentation runs by itself. */
  advanceAfterMs?: number
  elements: DeckElement[]
  /** Animation ids in play order; absent = element order, then each one's order. */
  animationOrder?: string[]
  notes?: string
}

/** Where an element sits, in design pixels, and how it shows. */
export interface DeckElementBase {
  id: string
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  opacity?: number
  locked?: boolean
  animations?: DeckAnimation[]
}

export interface DeckTextElement extends DeckElementBase {
  type: 'text'
  /** Sanitized HTML: inline styles for font, size, colour, bold, alignment, bullets. */
  html: string
  verticalAlign?: (typeof DECK_VERTICAL_ALIGNS)[number]
  fontFamily?: string
  fontSize?: number
  color?: string
  autofitScale?: number
  padding?: number
}

export interface DeckImageElement extends DeckElementBase {
  type: 'image'
  mediaId: string
  fit?: (typeof DECK_IMAGE_FITS)[number]
  /** Fractions cut from each side. */
  crop?: { l: number; t: number; r: number; b: number }
}

export interface DeckVideoElement extends DeckElementBase {
  type: 'video'
  mediaId: string
  posterMediaId?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  volume?: number
}

export interface DeckShapeElement extends DeckElementBase {
  type: 'shape'
  shape: DeckShape
  fill?: string
  stroke?: string
  strokeWidth?: number
  html?: string
}

/** What could not be rebuilt as our own elements (a SmartArt, a chart), as a picture. */
export interface DeckPictureFallbackElement extends DeckElementBase {
  type: 'picture_fallback'
  mediaId: string
  reason: (typeof DECK_FALLBACK_REASONS)[number]
}

export type DeckElement =
  | DeckTextElement
  | DeckImageElement
  | DeckVideoElement
  | DeckShapeElement
  | DeckPictureFallbackElement

export interface DeckAnimation {
  id: string
  kind: DeckAnimationKind
  effect: DeckAnimationEffect
  direction?: DeckDirection
  trigger: DeckTrigger
  delayMs: number
  durationMs: number
  /** By-paragraph builds: the paragraph of a text element it animates. */
  paragraphIndex?: number
}

/** One animation of a slide's timeline, with when it starts in its click group. */
export interface DeckTimedAnimation {
  elementId: string
  animation: DeckAnimation
  /** From the click (or the slide's entry, for group 0). */
  startMs: number
}

/**
 * A slide's animations as PowerPoint plays them: group 0 plays by itself as
 * the slide comes in, each further group on a click (Down).
 */
export type DeckClickGroup = DeckTimedAnimation[]

/** A deck's step: a slide with its click groups up to `buildIndex` played. */
export interface DeckStep {
  slideIndex: number
  buildIndex: number
}

/**
 * How a deck slide comes on screen (usePresentationContent): `enter` plays
 * its transition then its group 0, `build` plays its click group
 * `buildIndex`, `static` shows how the step ends, with nothing played (a
 * step back, a jump, a screen that just opened).
 */
export type DeckSlideEntry = 'static' | 'enter' | 'build'

/** A deck slide as a screen draws it. */
export interface DeckShownSlide {
  /** Changes with each step: what the animations are played for. */
  key: string
  itemId: number
  width: number
  height: number
  slide: DeckSlide
  slideIndex: number
  buildIndex: number
  entry: DeckSlideEntry
  /** The slide it comes in over, drawn as it was left, for its transition. */
  previous: {
    width: number
    height: number
    slide: DeckSlide
    buildIndex: number
  } | null
}

/** How one animated part (an element, or a paragraph of one) is left by its effects. */
export interface DeckTargetState {
  visible: boolean
  opacity: number
  scale: number
}

/** How a deck's titles and text look by default: its presentation's theme. */
export interface DeckTextStyle {
  fontFamily?: string
  /** On a 1920-wide slide. */
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  alignment: 'left' | 'center' | 'right'
  /** The theme's slide colour, for a new slide's background. */
  background: string
}

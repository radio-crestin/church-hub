import {
  DECK_ANIMATION_EFFECTS,
  DECK_ANIMATION_KINDS,
  DECK_DIRECTIONS,
  DECK_FALLBACK_REASONS,
  DECK_FITS,
  DECK_IMAGE_FITS,
  DECK_SHAPES,
  DECK_SLIDE_KINDS,
  DECK_TRANSITION_EFFECTS,
  DECK_TRIGGERS,
  DECK_VERTICAL_ALIGNS,
} from '../../service/slides-deck/types'

const mediaId = {
  type: 'string',
  description: 'A media id of the backgrounds gallery (/api/media/backgrounds)',
}
const color = {
  type: 'string',
  description: '#hex, rgb()/rgba()/hsl()/hsla() or a colour name',
}
const html = {
  type: 'string',
  description:
    'Sanitized on save: only p, div, span, br, b, strong, i, em, u, ul, ol, li, with style limited to font-size, font-family, color, text-align, font-weight, font-style, text-decoration, line-height, margin-left, margin-top, margin-bottom',
}
const direction = { type: 'string', enum: [...DECK_DIRECTIONS] }

/** A presentation's Slides item: a deck of our own slides (service/slides-deck). */
export const slidesDeckSchemas = {
  SlideDeck: {
    type: 'object',
    required: ['slides'],
    description:
      "A Slides item's deck, its itemConfig. Each slide is one step as it comes in (its transition, then its animations that play by themselves), then one more per animation on click (Down), like PowerPoint",
    properties: {
      width: {
        type: 'number',
        default: 1920,
        description: 'Design width the slides are laid out on',
      },
      height: { type: 'number', default: 1080 },
      slides: {
        type: 'array',
        items: { $ref: '#/components/schemas/DeckSlide' },
      },
      source: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['pptx'] },
          fileName: { type: 'string' },
        },
      },
    },
  },
  DeckSlide: {
    type: 'object',
    required: ['id', 'kind', 'elements'],
    properties: {
      id: { type: 'string', description: 'Unique in the deck' },
      kind: { type: 'string', enum: [...DECK_SLIDE_KINDS] },
      background: {
        type: 'object',
        required: ['type'],
        description:
          "{ type: 'color', color } or { type: 'image' | 'video', mediaId, fit }",
        properties: {
          type: { type: 'string', enum: ['color', 'image', 'video'] },
          color,
          mediaId,
          fit: { type: 'string', enum: [...DECK_FITS] },
        },
      },
      transition: {
        type: 'object',
        required: ['effect', 'durationMs'],
        properties: {
          effect: { type: 'string', enum: [...DECK_TRANSITION_EFFECTS] },
          direction,
          durationMs: { type: 'number' },
        },
      },
      advanceAfterMs: {
        type: 'number',
        description:
          'How long each of its steps stays up while the presentation runs by itself',
      },
      elements: {
        type: 'array',
        items: { $ref: '#/components/schemas/DeckElement' },
      },
      animationOrder: {
        type: 'array',
        items: { type: 'string' },
        description:
          "Animation ids in play order; absent = element order, then each element's animations",
      },
      notes: { type: 'string' },
    },
  },
  DeckElement: {
    type: 'object',
    required: ['id', 'type', 'x', 'y', 'w', 'h'],
    description:
      'Positioned in design pixels. text: html (+ verticalAlign, fontFamily, fontSize, color, autofitScale, padding); image: mediaId, fit, crop; video: mediaId, posterMediaId, autoplay, loop, muted, volume; shape: shape, fill, stroke, strokeWidth, html; picture_fallback: mediaId, reason',
    properties: {
      id: { type: 'string', description: 'Unique on its slide' },
      type: {
        type: 'string',
        enum: ['text', 'image', 'video', 'shape', 'picture_fallback'],
      },
      x: { type: 'number' },
      y: { type: 'number' },
      w: { type: 'number' },
      h: { type: 'number' },
      rotation: { type: 'number', description: 'Degrees' },
      opacity: { type: 'number', minimum: 0, maximum: 1 },
      locked: { type: 'boolean' },
      animations: {
        type: 'array',
        items: { $ref: '#/components/schemas/DeckAnimation' },
      },
      html,
      verticalAlign: { type: 'string', enum: [...DECK_VERTICAL_ALIGNS] },
      fontFamily: { type: 'string' },
      fontSize: { type: 'number' },
      color,
      autofitScale: { type: 'number' },
      padding: { type: 'number' },
      mediaId,
      fit: { type: 'string', enum: [...DECK_IMAGE_FITS] },
      crop: {
        type: 'object',
        description: 'Fractions cut from each side',
        properties: {
          l: { type: 'number' },
          t: { type: 'number' },
          r: { type: 'number' },
          b: { type: 'number' },
        },
      },
      posterMediaId: mediaId,
      autoplay: { type: 'boolean' },
      loop: { type: 'boolean' },
      muted: { type: 'boolean' },
      volume: { type: 'number', minimum: 0, maximum: 1 },
      shape: { type: 'string', enum: [...DECK_SHAPES] },
      fill: color,
      stroke: color,
      strokeWidth: { type: 'number' },
      reason: { type: 'string', enum: [...DECK_FALLBACK_REASONS] },
    },
  },
  DeckAnimation: {
    type: 'object',
    required: ['id', 'kind', 'effect', 'trigger', 'delayMs', 'durationMs'],
    properties: {
      id: { type: 'string', description: 'Unique on its slide' },
      kind: { type: 'string', enum: [...DECK_ANIMATION_KINDS] },
      effect: { type: 'string', enum: [...DECK_ANIMATION_EFFECTS] },
      direction,
      trigger: { type: 'string', enum: [...DECK_TRIGGERS] },
      delayMs: { type: 'number' },
      durationMs: { type: 'number' },
      paragraphIndex: {
        type: 'integer',
        description: 'By-paragraph builds: the paragraph it animates',
      },
    },
  },
  TemporaryDeckSlideContent: {
    type: 'object',
    required: [
      'itemId',
      'width',
      'height',
      'slide',
      'slideIndex',
      'slideCount',
      'buildIndex',
    ],
    description:
      "One slide of a presentation's Slides item, with its click groups up to buildIndex played",
    properties: {
      itemId: { type: 'integer' },
      width: { type: 'number', description: "The deck's design width" },
      height: { type: 'number' },
      slide: { $ref: '#/components/schemas/DeckSlide' },
      slideIndex: { type: 'integer' },
      slideCount: { type: 'integer' },
      buildIndex: {
        type: 'integer',
        description:
          '0: the slide as it comes in; each Down plays one more click group',
      },
      scheduleId: { type: 'integer' },
      scheduleItemIndex: { type: 'integer' },
      templateId: { type: 'integer', nullable: true },
    },
  },
}

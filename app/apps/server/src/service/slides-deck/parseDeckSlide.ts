import { deckReader } from './deckReader'
import { parseDeckElement } from './parseDeckElement'
import {
  DECK_DIRECTIONS,
  DECK_FITS,
  DECK_SLIDE_KINDS,
  DECK_TRANSITION_EFFECTS,
  type DeckBackground,
  type DeckSlide,
  type DeckTransition,
} from './types'

function parseBackground(value: unknown, path: string): DeckBackground {
  const r = deckReader(value, path)
  const type = r.oneOf('type', ['color', 'image', 'video'] as const)
  if (type === 'color') {
    return {
      type,
      color: r.optionalColor('color') ?? r.fail('color', 'is required'),
    }
  }
  return { type, mediaId: r.mediaId(), fit: r.optionalOneOf('fit', DECK_FITS) }
}

function parseTransition(value: unknown, path: string): DeckTransition {
  const r = deckReader(value, path)
  return {
    effect: r.oneOf('effect', DECK_TRANSITION_EFFECTS),
    direction: r.optionalOneOf('direction', DECK_DIRECTIONS),
    durationMs: r.number('durationMs', 0, 60_000),
  }
}

/** Refuses a second element or animation with the same id on one slide. */
function assertUnique(ids: string[], what: string, path: string): void {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id))
      throw new Error(`Invalid deck: ${path} has two ${what} "${id}"`)
    seen.add(id)
  }
}

/** One slide of a deck, checked field by field and rebuilt. */
export function parseDeckSlide(value: unknown, path: string): DeckSlide {
  const r = deckReader(value, path)
  const elements = r
    .array('elements', 500)
    .map((e, i) => parseDeckElement(e, `${path}.elements[${i}]`))
  assertUnique(
    elements.map((e) => e.id),
    'elements',
    path,
  )
  assertUnique(
    elements.flatMap((e) => (e.animations ?? []).map((a) => a.id)),
    'animations',
    path,
  )
  const order = r.value('animationOrder')
  return {
    id: r.id(),
    kind: r.oneOf('kind', DECK_SLIDE_KINDS),
    background:
      r.value('background') === undefined
        ? undefined
        : parseBackground(r.value('background'), `${path}.background`),
    transition:
      r.value('transition') === undefined
        ? undefined
        : parseTransition(r.value('transition'), `${path}.transition`),
    advanceAfterMs: r.optionalNumber('advanceAfterMs', 0, 3_600_000),
    elements,
    animationOrder:
      order === undefined
        ? undefined
        : r
            .array('animationOrder', 5000)
            .map((id) =>
              typeof id === 'string'
                ? id
                : r.fail('animationOrder', 'must list animation ids'),
            ),
    notes:
      r.value('notes') === undefined ? undefined : r.string('notes', 20_000),
  }
}

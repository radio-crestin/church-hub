import type { DeckShape } from '../../types'

const SHAPES: Record<string, DeckShape> = {
  rect: 'rect',
  roundRect: 'roundRect',
  ellipse: 'ellipse',
  triangle: 'triangle',
  line: 'line',
  straightConnector1: 'line',
}

/**
 * The deck's shape for a preset geometry (`a:prstGeom prst`); connectors are
 * lines; null for one the deck cannot draw.
 */
export function deckShapeOf(
  geometry: string,
  connector: boolean,
): DeckShape | null {
  if (connector) return 'line'
  return SHAPES[geometry] ?? null
}

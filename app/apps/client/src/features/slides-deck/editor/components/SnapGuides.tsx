import type { DeckGuide } from '../types'

/** The guide lines a dragged element met, over the canvas. */
export function SnapGuides({
  guides,
  scale,
}: {
  guides: DeckGuide[]
  scale: number
}) {
  return (
    <>
      {guides.map((guide) => (
        <div
          key={`${guide.axis}${guide.at}`}
          data-testid="deck-editor-guide"
          className="pointer-events-none absolute bg-focus"
          style={
            guide.axis === 'x'
              ? { left: guide.at * scale, top: 0, bottom: 0, width: 1 }
              : { top: guide.at * scale, left: 0, right: 0, height: 1 }
          }
        />
      ))}
    </>
  )
}

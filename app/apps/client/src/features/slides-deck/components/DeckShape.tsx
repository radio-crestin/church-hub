import type { DeckShapeElement } from '../types'

/** PowerPoint's default shape fill. */
const DEFAULT_FILL = '#4472c4'

function ShapeOutline({ element }: { element: DeckShapeElement }) {
  const { w, h } = element
  const fill =
    element.shape === 'line' ? 'none' : (element.fill ?? DEFAULT_FILL)
  const stroke =
    element.stroke ?? (element.shape === 'line' ? '#ffffff' : 'none')
  const strokeWidth = element.strokeWidth ?? (element.shape === 'line' ? 4 : 0)
  const paint = { fill, stroke, strokeWidth }
  switch (element.shape) {
    case 'rect':
      return <rect width={w} height={h} {...paint} />
    case 'roundRect': {
      const radius = Math.min(w, h) * 0.1
      return <rect width={w} height={h} rx={radius} ry={radius} {...paint} />
    }
    case 'ellipse':
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...paint} />
    case 'triangle':
      return <polygon points={`${w / 2},0 ${w},${h} 0,${h}`} {...paint} />
    case 'line':
      return <line x1={0} y1={0} x2={w} y2={h} {...paint} />
  }
}

/** A shape on a deck slide, drawn in SVG, with its text over it. */
export function DeckShape({ element }: { element: DeckShapeElement }) {
  return (
    <div className="relative h-full w-full">
      <svg
        className="absolute inset-0 overflow-visible"
        width="100%"
        height="100%"
        viewBox={`0 0 ${element.w} ${element.h}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <ShapeOutline element={element} />
      </svg>
      {element.html ? (
        <div
          className="absolute inset-0 flex flex-col justify-center text-center"
          style={{ color: '#ffffff', fontSize: 32 }}
          // Sanitized by the server when the deck was saved (sanitizeDeckHtml).
          dangerouslySetInnerHTML={{ __html: element.html }}
        />
      ) : null}
    </div>
  )
}

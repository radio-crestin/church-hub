import type { AnnotationTool } from '../types'

// Lucide's pencil, tip at the bottom left (the cursor's hotspot).
const PENCIL_PATH =
  'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'

/** A pencil cursor filled with the chosen colour, outlined so it shows on any screen. */
function pencilCursor(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="${PENCIL_PATH}" fill="${color}" stroke="#111827" stroke-width="1.5" stroke-linejoin="round"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 22, crosshair`
}

/** The CSS cursor for each markup tool: pencil to draw, crosshair for shapes, text for notes. */
export function getToolCursor(tool: AnnotationTool, color: string): string {
  if (tool === 'pen' || tool === 'highlighter') return pencilCursor(color)
  if (tool === 'note') return 'text'
  return 'crosshair'
}

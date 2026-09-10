/**
 * The slide's text exactly as the editor holds it — the same string the style
 * runs' character offsets are counted against, and the same one the editor
 * hands back when the operator types.
 *
 * Non-breaking spaces are left in: they are part of what is on the canvas, and
 * the offsets recorded for a selection include them. They are swapped for plain
 * spaces on the way back out to the slide, where the editor's own input handler
 * does the same.
 */
export function readSlideText(): string | null {
  const editor = document.querySelector<HTMLElement>(
    '[data-testid="slide-canvas-editable"]',
  )
  return editor ? editor.innerText : null
}

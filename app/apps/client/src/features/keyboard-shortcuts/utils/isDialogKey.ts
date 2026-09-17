/**
 * Whether a key press belongs to a dialog rather than to the page behind it:
 * it was pressed inside a `<dialog>`, or one is open while focus sits outside
 * it (clicking a dialog's plain text leaves focus on the body, yet the browser
 * still cancels that dialog on Escape).
 *
 * The path is the one the event was dispatched along, so a press that closed
 * its own dialog before reaching the window still counts as the dialog's.
 */
export function isDialogKey(event: KeyboardEvent): boolean {
  const pressedInDialog = event
    .composedPath()
    .some((node) => node instanceof HTMLDialogElement)
  return pressedInDialog || document.querySelector('dialog[open]') !== null
}

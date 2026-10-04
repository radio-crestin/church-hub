import { isFeatureRequestUi } from './isFeatureRequestUi'

/** The top-most app element under the pointer, skipping the tool's overlays. */
export function findPickableElement(x: number, y: number): Element | null {
  return (
    document
      .elementsFromPoint(x, y)
      .find(
        (element) =>
          !isFeatureRequestUi(element) &&
          element !== document.documentElement &&
          element !== document.body,
      ) ?? null
  )
}

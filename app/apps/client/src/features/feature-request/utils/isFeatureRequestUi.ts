/** Attribute on the tool's own overlays: never picked, never in the screenshot. */
export const FEATURE_REQUEST_UI_ATTRIBUTE = 'data-feature-request-ui'

export function isFeatureRequestUi(node: Node): boolean {
  return (
    node instanceof Element &&
    node.closest(`[${FEATURE_REQUEST_UI_ATTRIBUTE}]`) !== null
  )
}

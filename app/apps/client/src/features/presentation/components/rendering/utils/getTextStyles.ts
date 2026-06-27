import type { TextStyle } from '../../../types'

/**
 * Convert a TextStyle into CSS properties. Shared by the read-only renderer
 * (AnimatedText) and the in-place slide editor (EditableMainText) so edited text
 * looks identical to the projected text.
 */
export function getTextStyles(style: TextStyle): React.CSSProperties {
  const css: React.CSSProperties = {
    fontFamily: style.fontFamily,
    color: style.color,
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    textAlign: style.alignment ?? 'center',
    lineHeight: style.lineHeight ?? 1.3,
  }

  if (style.shadow) {
    css.textShadow = `2px 2px 4px rgba(0, 0, 0, 0.5)`
  }

  return css
}

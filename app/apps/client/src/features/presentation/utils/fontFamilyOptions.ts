/**
 * Fonts offered by the screen editor's Font Family pickers. The stored value is
 * the plain font name; `getFontFamilyStack` turns it into a cross-platform CSS
 * font stack when the text is rendered, so every font listed here must have a
 * fallback stack there.
 */
export const FONT_FAMILY_OPTIONS = [
  { value: 'system-ui', label: 'System Default' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Verdana', label: 'Verdana' },
]

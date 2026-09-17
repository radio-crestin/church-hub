/**
 * Fallback chains for the fonts a screen can be configured with. Each chain
 * lists the font itself, its usual macOS/Windows name, a metric-compatible
 * clone shipped by most Linux distributions (Liberation, Croscore, DejaVu,
 * Gelasio) and finally a generic family, so text keeps its look and line
 * breaks on machines that lack the original font.
 */
const FONT_STACKS: Record<string, string[]> = {
  'system-ui': [
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Roboto',
    'Ubuntu',
    'Cantarell',
    'Noto Sans',
    'sans-serif',
  ],
  arial: ['Arial', 'Helvetica', 'Liberation Sans', 'Arimo', 'sans-serif'],
  georgia: ['Georgia', 'Gelasio', 'DejaVu Serif', 'serif'],
  'times new roman': [
    'Times New Roman',
    'Times',
    'Liberation Serif',
    'Tinos',
    'serif',
  ],
  verdana: ['Verdana', 'Geneva', 'DejaVu Sans', 'sans-serif'],
  'courier new': [
    'Courier New',
    'Courier',
    'Liberation Mono',
    'Cousine',
    'monospace',
  ],
}

const UNQUOTED_FAMILIES = new Set([
  '-apple-system',
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
])

function formatFamilyName(name: string): string {
  if (UNQUOTED_FAMILIES.has(name) || /^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)) {
    return name
  }
  return `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function inferGenericFamily(name: string): string {
  const lower = name.toLowerCase()
  if (/mono|courier|consol|code/.test(lower)) return 'monospace'
  if (lower.includes('serif') && !lower.includes('sans')) return 'serif'
  return 'sans-serif'
}

/**
 * CSS `font-family` value for a configured font name. Stored configs keep the
 * plain name (e.g. `Times New Roman`); only the rendered CSS gets the
 * cross-platform fallbacks. A value that already is a stack (contains a comma)
 * or a generic family is used as is; an unknown font gets a generic family
 * guessed from its name. Returns undefined for a missing name so the text
 * inherits the surrounding font, as before.
 */
export function getFontFamilyStack(
  fontFamily: string | null | undefined,
): string | undefined {
  const value = fontFamily?.trim()
  if (value?.includes(',')) return value

  const name = value?.replace(/^(['"])(.*)\1$/, '$2').trim()
  if (!name) return undefined

  const stack = FONT_STACKS[name.toLowerCase()]
  if (stack) return stack.map(formatFamilyName).join(', ')
  if (UNQUOTED_FAMILIES.has(name.toLowerCase())) return name.toLowerCase()

  return `${formatFamilyName(name)}, ${inferGenericFamily(name)}`
}

const ALLOWED_TAGS = new Set([
  'p',
  'div',
  'span',
  'br',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ul',
  'ol',
  'li',
])

const ALLOWED_STYLES = new Set([
  'font-size',
  'font-family',
  'color',
  'text-align',
  'font-weight',
  'font-style',
  'text-decoration',
  'line-height',
  // An imported PowerPoint paragraph's indent and spacing.
  'margin-left',
  'margin-top',
  'margin-bottom',
])

/** Elements dropped with everything in them. */
const DROPPED_WITH_CONTENT =
  /<(script|style|iframe|object|embed|template|noscript|textarea|title|svg|math)\b[\s\S]*?<\/\1\s*>/gi

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g
const STYLE_ATTRIBUTE = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i
/** Fonts, sizes, colours (#hex, rgb()), alignment: nothing that loads or runs. */
const SAFE_STYLE_VALUE = /^[\w\s#%.,'()+-]*$/
const UNSAFE_STYLE_VALUE = /url\s*\(|expression\s*\(/i

/** Text with no markup left in it; entities kept, a bare `&` escaped. */
function escapeText(text: string): string {
  return text
    .replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** The allowed declarations of a `style` attribute, double quotes made single. */
function sanitizeStyle(style: string): string {
  return style
    .replace(/&quot;|&#34;/g, "'")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/"/g, "'")
    .split(';')
    .map((declaration) => {
      const colon = declaration.indexOf(':')
      if (colon < 0) return null
      const property = declaration.slice(0, colon).trim().toLowerCase()
      const value = declaration.slice(colon + 1).trim()
      if (!ALLOWED_STYLES.has(property) || !value) return null
      if (!SAFE_STYLE_VALUE.test(value) || UNSAFE_STYLE_VALUE.test(value)) {
        return null
      }
      return `${property}: ${value}`
    })
    .filter(Boolean)
    .join('; ')
}

function sanitizeTag(closing: string, name: string, attributes: string) {
  const tag = name.toLowerCase()
  if (!ALLOWED_TAGS.has(tag)) return ''
  if (closing) return tag === 'br' ? '' : `</${tag}>`
  const match = attributes.match(STYLE_ATTRIBUTE)
  const style = sanitizeStyle(match?.[1] ?? match?.[2] ?? '')
  return style ? `<${tag} style="${style}">` : `<${tag}>`
}

/**
 * A text box's HTML as the screens may show it: only paragraphs, line breaks,
 * spans, bold, italic, underline and lists, each with only its font, size,
 * colour, weight, style, decoration, alignment, line height, and left, top
 * and bottom margins. Every other tag goes (its text stays; a script's or style's goes with it), as do all
 * other attributes, so nothing in a deck can run or load anything.
 */
export function sanitizeDeckHtml(html: string): string {
  const source = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(DROPPED_WITH_CONTENT, '')
  let result = ''
  let last = 0
  for (const match of source.matchAll(TAG)) {
    result += escapeText(source.slice(last, match.index))
    result += sanitizeTag(match[1] ?? '', match[2] ?? '', match[3] ?? '')
    last = (match.index ?? 0) + match[0].length
  }
  return result + escapeText(source.slice(last))
}

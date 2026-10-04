import { escapeMarkdown } from './escapeMarkdown'
import { normalizeHighlightColor } from './normalizeHighlightColor'
import { DEFAULT_HIGHLIGHT_COLOR, type MarkdownStyleRange } from './types'

/** Style layers from the outermost marker to the innermost one. */
const LAYERS = ['underline', 'highlight', 'bold', 'italic'] as const
type Layer = (typeof LAYERS)[number]

/** The styling in force over one stretch of text. */
interface SegmentStyle {
  highlight: string
  bold: boolean
  italic: boolean
  underline: boolean
}

const UNSTYLED: SegmentStyle = {
  highlight: '',
  bold: false,
  italic: false,
  underline: false,
}

/**
 * Writes plain text and its style ranges as standard Markdown (CommonMark
 * plus its inline HTML): `**bold**`, `*italic*`, `<u>underline</u>`,
 * `<mark>highlight</mark>` (with `style="background-color: …"` for a colour
 * other than the default).
 *
 * Ranges may overlap; the text is cut wherever a range starts or ends and the
 * markers are always properly nested, so every reader sees the same words
 * styled. A range is shrunk to start and end on a visible character.
 */
export function formatStyledMarkdown(
  text: string,
  ranges: MarkdownStyleRange[],
): string {
  const usable = ranges
    .map((range) => shrinkToVisible(text, range))
    .filter((range): range is MarkdownStyleRange => range !== null)

  const cuts = [
    ...new Set([
      0,
      text.length,
      ...usable.flatMap((range) => [range.start, range.end]),
    ]),
  ].sort((a, b) => a - b)

  const segments: string[] = []
  const boundaries: Boundary[] = []
  let current = UNSTYLED

  for (let i = 0; i < cuts.length - 1; i++) {
    const next = styleOver(usable, cuts[i], cuts[i + 1])
    boundaries.push(switchMarkers(current, next))
    segments.push(text.slice(cuts[i], cuts[i + 1]))
    current = next
  }
  boundaries.push(switchMarkers(current, UNSTYLED))

  return joinKeepingEmphasisOffSpaces(segments, boundaries)
}

/** Markers between two segments: the closing ones, then the opening ones. */
interface Boundary {
  close: string
  open: string
}

/**
 * Joins the segments with their markers. Where `**` or `*` sits next to a
 * space, the space moves between the closing and the opening markers:
 * CommonMark only reads `**` as bold when it touches a visible character.
 */
function joinKeepingEmphasisOffSpaces(
  segments: string[],
  boundaries: Boundary[],
): string {
  const texts = [...segments]
  const spaces = boundaries.map(() => '')

  boundaries.forEach((boundary, i) => {
    if (!/\*/.test(boundary.close + boundary.open)) return
    if (i > 0) {
      const tail = texts[i - 1].match(/\s*$/)?.[0] ?? ''
      texts[i - 1] = texts[i - 1].slice(0, texts[i - 1].length - tail.length)
      spaces[i] += tail
    }
    if (i < texts.length) {
      const head = texts[i].match(/^\s*/)?.[0] ?? ''
      texts[i] = texts[i].slice(head.length)
      spaces[i] += head
    }
  })

  return boundaries
    .map((boundary, i) => {
      const marked = boundary.close + spaces[i] + boundary.open
      return i < texts.length ? marked + escapeMarkdown(texts[i]) : marked
    })
    .join('')
}

/** Clamps a range to the text and trims the whitespace off both its ends. */
function shrinkToVisible(
  text: string,
  range: MarkdownStyleRange,
): MarkdownStyleRange | null {
  let start = Math.max(0, Math.min(range.start, text.length))
  let end = Math.max(start, Math.min(range.end, text.length))
  while (start < end && /\s/.test(text[start])) start++
  while (end > start && /\s/.test(text[end - 1])) end--
  const styled =
    range.bold || range.italic || range.underline || range.highlight
  return start < end && styled ? { ...range, start, end } : null
}

/** The combined styling of every range covering `[start, end)`. */
function styleOver(
  ranges: MarkdownStyleRange[],
  start: number,
  end: number,
): SegmentStyle {
  const style = { ...UNSTYLED }
  for (const range of ranges) {
    if (range.start > start || range.end < end) continue
    if (range.highlight)
      style.highlight = normalizeHighlightColor(range.highlight)
    if (range.bold) style.bold = true
    if (range.italic) style.italic = true
    if (range.underline) style.underline = true
  }
  return style
}

/**
 * Closes the layers that change, innermost first, then opens the new ones,
 * outermost first, so the markers never cross.
 */
function switchMarkers(from: SegmentStyle, to: SegmentStyle): Boundary {
  const firstChanged = LAYERS.findIndex((layer) => from[layer] !== to[layer])
  if (firstChanged === -1) return { close: '', open: '' }

  let close = ''
  for (let i = LAYERS.length - 1; i >= firstChanged; i--) {
    if (from[LAYERS[i]]) close += closeMarker(LAYERS[i])
  }
  let open = ''
  for (let i = firstChanged; i < LAYERS.length; i++) {
    if (to[LAYERS[i]]) open += openMarker(LAYERS[i], to)
  }
  return { close, open }
}

function openMarker(layer: Layer, style: SegmentStyle): string {
  switch (layer) {
    case 'highlight':
      return style.highlight === DEFAULT_HIGHLIGHT_COLOR
        ? '<mark>'
        : `<mark style="background-color: ${style.highlight}">`
    case 'bold':
      return '**'
    case 'italic':
      return '*'
    case 'underline':
      return '<u>'
  }
}

function closeMarker(layer: Layer): string {
  switch (layer) {
    case 'highlight':
      return '</mark>'
    case 'bold':
      return '**'
    case 'italic':
      return '*'
    case 'underline':
      return '</u>'
  }
}

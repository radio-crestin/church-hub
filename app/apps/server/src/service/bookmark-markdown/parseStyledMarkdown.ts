import { normalizeHighlightColor } from './normalizeHighlightColor'
import {
  DEFAULT_HIGHLIGHT_COLOR,
  type MarkdownStyleRange,
  type StyledText,
} from './types'

type Attribute = 'bold' | 'italic' | 'underline' | 'highlight'

type Token =
  | { kind: 'text'; value: string }
  | {
      kind: 'marker'
      attribute: Attribute
      /** A toggle (`**`, `*`, `==`) opens when nothing is open, else closes. */
      role: 'toggle' | 'open' | 'close'
      /** Which marker family it belongs to, so `==` never closes `<mark>`. */
      family: string
      color?: string
      raw: string
      /** CommonMark flanking: `**` next to a space cannot open or close. */
      canOpen?: boolean
      canClose?: boolean
      /** Set once paired; an unpaired marker is read as plain text. */
      paired?: boolean
      isOpening?: boolean
    }

const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/

const TAG = /^<(\/?)(u|ins|mark|strong|b|em|i)(\s[^>]*)?>/i

const TAG_ATTRIBUTE: Record<string, Attribute> = {
  u: 'underline',
  ins: 'underline',
  mark: 'highlight',
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
}

/**
 * Reads the Markdown `formatStyledMarkdown` writes back into plain text and
 * style ranges. Also accepts the HTML spellings a person might type
 * (`<strong>`, `<b>`, `<em>`, `<i>`, `<ins>`, `<mark>`).
 *
 * A marker that is never closed stays as plain text, so a stray `*` in a
 * pasted verse does not italicise the rest of it.
 */
export function parseStyledMarkdown(markdown: string): StyledText {
  const tokens = tokenize(markdown)
  pairMarkers(tokens)
  return collectStyledText(tokens)
}

function tokenize(markdown: string): Token[] {
  const tokens: Token[] = []
  const pushText = (value: string) => {
    const last = tokens[tokens.length - 1]
    if (last?.kind === 'text') last.value += value
    else tokens.push({ kind: 'text', value })
  }

  let i = 0
  while (i < markdown.length) {
    const char = markdown[i]
    const rest = markdown.slice(i)

    if (char === '\\' && i + 1 < markdown.length) {
      const next = markdown[i + 1]
      if (ASCII_PUNCTUATION.test(next) || next === '\n') {
        pushText(next)
        i += 2
        continue
      }
    }

    if (rest.startsWith('**')) {
      tokens.push(toggle('bold', '**', markdown[i - 1], markdown[i + 2]))
      i += 2
      continue
    }
    if (char === '*') {
      tokens.push(toggle('italic', '*', markdown[i - 1], markdown[i + 1]))
      i += 1
      continue
    }
    if (rest.startsWith('==')) {
      tokens.push(toggle('highlight', '==', markdown[i - 1], markdown[i + 2]))
      i += 2
      continue
    }

    const tag = char === '<' ? rest.match(TAG) : null
    if (tag) {
      const name = tag[2].toLowerCase()
      const attribute = TAG_ATTRIBUTE[name]
      const isClosing = tag[1] === '/'
      tokens.push({
        kind: 'marker',
        attribute,
        role: isClosing ? 'close' : 'open',
        family: `<${attribute}>`,
        color:
          attribute === 'highlight' && !isClosing
            ? readMarkColor(tag[3] ?? '')
            : undefined,
        raw: tag[0],
      })
      i += tag[0].length
      continue
    }

    pushText(char)
    i += 1
  }

  return tokens
}

function toggle(
  attribute: Attribute,
  raw: string,
  before: string | undefined,
  after: string | undefined,
): Token {
  return {
    kind: 'marker',
    attribute,
    role: 'toggle',
    family: raw,
    canOpen: after !== undefined && !/\s/.test(after),
    canClose: before !== undefined && !/\s/.test(before),
    color: attribute === 'highlight' ? DEFAULT_HIGHLIGHT_COLOR : undefined,
    raw,
  }
}

/** Reads `style="background-color: …"`, `style="background: …"` or `data-color`. */
function readMarkColor(attributes: string): string {
  const color =
    attributes.match(/background(?:-color)?\s*:\s*([^;"']+)/i)?.[1] ??
    attributes.match(/data-color\s*=\s*["']?([^"'\s>]+)/i)?.[1]
  return color ? normalizeHighlightColor(color) : DEFAULT_HIGHLIGHT_COLOR
}

/** Matches each opening marker with the next closing one of its family. */
function pairMarkers(tokens: Token[]): void {
  const open = new Map<string, Token[]>()

  for (const token of tokens) {
    if (token.kind !== 'marker') continue
    const stack = open.get(token.family) ?? []
    open.set(token.family, stack)

    const closes =
      token.role === 'close' ||
      (token.role === 'toggle' && stack.length > 0 && token.canClose)
    if (!closes) {
      if (token.role === 'open' || token.canOpen) stack.push(token)
      continue
    }

    const opener = stack.pop()
    if (!opener) continue
    opener.paired = true
    opener.isOpening = true
    token.paired = true
    token.isOpening = false
  }
}

/** Walks the paired markers, recording the styling over each run of text. */
function collectStyledText(tokens: Token[]): StyledText {
  let text = ''
  const depth: Record<Attribute, number> = {
    bold: 0,
    italic: 0,
    underline: 0,
    highlight: 0,
  }
  const colors: string[] = []
  const segments: Array<{ start: number; end: number } & StyleSnapshot> = []

  for (const token of tokens) {
    if (token.kind === 'text' || !token.paired) {
      const value = token.kind === 'text' ? token.value : token.raw
      const start = text.length
      text += value
      segments.push({
        start,
        end: text.length,
        bold: depth.bold > 0,
        italic: depth.italic > 0,
        underline: depth.underline > 0,
        highlight: colors[colors.length - 1] ?? '',
      })
      continue
    }

    if (token.isOpening) {
      depth[token.attribute]++
      if (token.attribute === 'highlight') {
        colors.push(token.color ?? DEFAULT_HIGHLIGHT_COLOR)
      }
    } else {
      depth[token.attribute]--
      if (token.attribute === 'highlight') colors.pop()
    }
  }

  return { text, ranges: toRanges(segments) }
}

interface StyleSnapshot {
  bold: boolean
  italic: boolean
  underline: boolean
  highlight: string
}

/** Turns per-segment styling into one range per unbroken run of a style. */
function toRanges(
  segments: Array<{ start: number; end: number } & StyleSnapshot>,
): MarkdownStyleRange[] {
  const ranges: MarkdownStyleRange[] = []

  for (const attribute of ['highlight', 'bold', 'italic', 'underline'] as const) {
    let open: MarkdownStyleRange | null = null
    for (const segment of segments) {
      if (segment.start === segment.end) continue
      const value = segment[attribute]
      const sameRun =
        open &&
        open.end === segment.start &&
        (attribute === 'highlight' ? open.highlight === value : true)

      if (value && sameRun && open) {
        open.end = segment.end
        continue
      }
      if (open) ranges.push(open)
      open = value
        ? {
            start: segment.start,
            end: segment.end,
            ...(attribute === 'highlight'
              ? { highlight: value as string }
              : { [attribute]: true }),
          }
        : null
    }
    if (open) ranges.push(open)
  }

  return ranges.sort((a, b) => a.start - b.start || a.end - b.end)
}

import type { TextSpan } from './typedSpans'

/** What a typewriter still hides of a piece of text, in its own offsets. */
export interface RevealOf {
  hidden: TextSpan[]
  /** Where the caret sits; null when it is in another piece */
  caret: number | null
}

const HIDDEN_ATTRIBUTE = 'data-typewriter-hidden'

/**
 * A thin bar in the text's colour, at no width, so the words never move
 * around it: an empty inline box holding the absolutely placed bar.
 */
const CARET =
  '<span aria-hidden="true" data-typewriter-caret style="position:relative">' +
  '<span style="position:absolute;left:0;top:0.12em;bottom:0.04em;width:0.06em;background:currentColor;opacity:0.75"></span>' +
  '</span>'

function textNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  return nodes
}

/** Cuts the text nodes so every one of `cuts` falls between two of them. */
function cutAt(root: Node, cuts: number[]): void {
  let offset = 0
  for (const node of textNodes(root)) {
    const start = offset
    offset += node.length
    cuts
      .filter((cut) => cut > start && cut < offset)
      .sort((a, b) => b - a)
      .forEach((cut) => node.splitText(cut - start))
  }
}

function hide(node: Text): void {
  const wrapper = document.createElement('span')
  wrapper.setAttribute(HIDDEN_ATTRIBUTE, '')
  wrapper.style.visibility = 'hidden'
  node.replaceWith(wrapper)
  wrapper.append(node)
}

/**
 * A piece of the slide's text (its styled HTML, or its plain text) with the
 * `hidden` spans kept in place but invisible, and the caret at `caret`. The
 * text keeps every character, so it lays out exactly as the whole text does
 * and a selection's offsets stay right while it types.
 */
export function revealMarkup(
  text: string,
  html: string | null,
  { hidden, caret }: RevealOf,
): string {
  const template = document.createElement('template')
  if (html) template.innerHTML = html
  else template.content.append(text)

  cutAt(template.content, [
    ...hidden.flat(),
    ...(caret === null ? [] : [caret]),
  ])
  let offset = 0
  for (const node of textNodes(template.content)) {
    const start = offset
    offset += node.length
    if (start === caret)
      node.before(document.createRange().createContextualFragment(CARET))
    if (hidden.some(([from, to]) => start >= from && start < to)) hide(node)
  }
  // A styled run with nothing typed yet hides its highlight too.
  template.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    const nodes = textNodes(element)
    if (
      nodes.length > 0 &&
      nodes.every((node) => node.parentElement?.hasAttribute(HIDDEN_ATTRIBUTE))
    ) {
      element.style.visibility = 'hidden'
    }
  })
  return template.innerHTML
}

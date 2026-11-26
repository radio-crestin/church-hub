import { readBackground } from './readBackground'
import { readNotes } from './readNotes'
import { readTransition } from './readTransition'
import { slideKind } from './slideKind'
import type { PptxDeckContext, PptxPart, PptxSlideParts } from './types'
import { uniqueElementIds } from './uniqueElementIds'
import type { DeckSlide } from '../../types'
import { newDeckId } from '../../utils/newDeckId'
import { applyTiming } from '../animation/applyTiming'
import { readTiming } from '../animation/readTiming'
import { appendRead } from '../shapes/appendRead'
import { emptyRead } from '../shapes/emptyRead'
import { placeholderOf } from '../shapes/placeholderOf'
import { readShapeTree } from '../shapes/readShapeTree'
import type { PptxTransform } from '../shapes/types'
import type { PptxImportNote } from '../types'
import { xmlChild } from '../xml/xmlChild'
import { xmlDescendants } from '../xml/xmlDescendants'

/** The most elements a deck slide may have (the server's validator). */
const MAX_ELEMENTS = 500

const asIs: PptxTransform = (box) => box

const showsMasterShapes = (part: PptxPart | null) =>
  part?.doc.documentElement.getAttribute('showMasterSp') !== '0'

/**
 * One slide as a deck slide: its background; the master's and layout's own
 * shapes under its own (unless it hides them, `showMasterSp="0"`); its
 * animations, transition, timing and speaker notes; with the summary lines
 * of what did not come in as it is.
 */
export async function readSlide(
  parts: PptxSlideParts,
  deck: PptxDeckContext,
): Promise<{ slide: DeckSlide; notes: PptxImportNote[] }> {
  const { slide, layout, master } = parts
  const shapes = emptyRead()
  const tree = (part: PptxPart | null) =>
    xmlChild(part?.doc.documentElement, 'cSld', 'spTree')
  const read = async (
    part: PptxPart | null,
    level: 'slide' | 'layout' | 'master',
    idPrefix: string,
  ) => {
    const root = tree(part)
    if (!part || !root) return emptyRead()
    return readShapeTree(root, asIs, {
      deck,
      parts,
      partPath: part.path,
      level,
      idPrefix,
    })
  }
  if (showsMasterShapes(slide)) {
    if (showsMasterShapes(layout))
      appendRead(shapes, await read(master, 'master', 'm'))
    appendRead(shapes, await read(layout, 'layout', 'l'))
  }
  const own = await read(slide, 'slide', '')
  const background = await readBackground(parts, deck)
  const transition = readTransition(slide.doc)
  const timed = applyTiming(
    uniqueElementIds([...shapes.elements, ...own.elements]).slice(
      0,
      MAX_ELEMENTS,
    ),
    own.targets,
    readTiming(slide.doc),
  )
  const hasTitle = xmlDescendants(tree(slide), 'sp').some((shape) =>
    ['title', 'ctrTitle'].includes(
      placeholderOf(shape)?.getAttribute('type') ?? '',
    ),
  )
  const notes = [
    ...background.notes,
    ...shapes.notes,
    ...own.notes,
    ...(transition.note ? [transition.note] : []),
    ...timed.notes,
  ].map((note) => ({ ...note, slide: parts.number }))
  return {
    slide: {
      id: newDeckId(),
      kind: slideKind(timed.elements, hasTitle),
      background: background.background,
      transition: transition.transition,
      advanceAfterMs: transition.advanceAfterMs,
      elements: timed.elements,
      animationOrder: timed.animationOrder,
      notes: await readNotes(deck.pkg, slide.path),
    },
    notes,
  }
}

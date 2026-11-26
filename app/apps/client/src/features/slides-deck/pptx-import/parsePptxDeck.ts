import { createMediaRegistry } from './media/createMediaRegistry'
import { referencedMedia } from './media/referencedMedia'
import { openPptxPackage } from './package/openPptxPackage'
import { readSlide } from './slide/readSlide'
import { readSlideParts } from './slide/readSlideParts'
import type { PptxDeckContext } from './slide/types'
import type { PptxImportNote, PptxParsedDeck } from './types'
import { xmlChild } from './xml/xmlChild'
import { xmlChildren } from './xml/xmlChildren'
import { xmlNumber } from './xml/xmlNumber'
import type { DeckSlide } from '../types'

/** A deck's design width; its height keeps the file's slide size's aspect. */
const DECK_WIDTH = 1920
/** The most slides a deck may have (the server's validator). */
const MAX_SLIDES = 1000

/**
 * A .pptx file read into a deck, in the browser: its slide size (`p:sldSz`)
 * as 1920 pixels wide, each slide shown in a show (hidden ones left out)
 * with its master, layout and theme, and the pictures and videos it shows,
 * still to upload (their media ids are tokens). Throws when the file is no
 * PowerPoint presentation.
 */
export async function parsePptxDeck(
  file: Blob,
  fileName: string,
): Promise<PptxParsedDeck> {
  const pkg = await openPptxPackage(file)
  const main = [...(await pkg.rels('')).values()].find(
    (r) => r.type === 'officeDocument',
  )
  const presentationPath = main?.target ?? 'ppt/presentation.xml'
  const presentation = await pkg.xml(presentationPath)
  if (!presentation) throw new Error('This file has no presentation in it')
  const root = presentation.documentElement
  const size = xmlChild(root, 'sldSz')
  const cx = xmlNumber(size, 'cx') || 12_192_000
  const cy = xmlNumber(size, 'cy') || 6_858_000
  const deck: PptxDeckContext = {
    pkg,
    scale: DECK_WIDTH / cx,
    defaultTextStyle: xmlChild(root, 'defaultTextStyle'),
    media: createMediaRegistry(),
  }
  const notes: PptxImportNote[] = []
  if (xmlChildren(xmlChild(root, 'embeddedFontLst')).length) {
    notes.push({ outcome: 'skipped', reason: 'embeddedFonts' })
  }

  const rels = await pkg.rels(presentationPath)
  const slides: DeckSlide[] = []
  const ids = xmlChildren(xmlChild(root, 'sldIdLst'), 'sldId')
  for (const [index, sldId] of ids.entries()) {
    const rel = rels.get(sldId.getAttribute('r:id') ?? '')
    const doc = rel ? await pkg.xml(rel.target) : null
    if (!rel || !doc || slides.length >= MAX_SLIDES) continue
    if (doc.documentElement.getAttribute('show') === '0') {
      notes.push({
        slide: index + 1,
        outcome: 'skipped',
        reason: 'hiddenSlide',
      })
      continue
    }
    const parts = await readSlideParts(
      pkg,
      { path: rel.target, doc },
      index + 1,
    )
    const read = await readSlide(parts, deck)
    slides.push(read.slide)
    notes.push(...read.notes)
  }
  if (!slides.length) throw new Error('This presentation has no slides to show')

  const result = {
    width: DECK_WIDTH,
    height: Math.round((DECK_WIDTH * cy) / cx),
    slides,
    source: { kind: 'pptx' as const, fileName: fileName.slice(0, 500) },
  }
  const used = referencedMedia(result)
  return {
    pkg,
    deck: result,
    media: deck.media.files().filter((file) => used.has(file.token)),
    notes,
  }
}

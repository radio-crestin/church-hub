import type { DeckElement } from '../../types'
import type { PptxMediaRegistry } from '../media/createMediaRegistry'
import type { PptxPackage } from '../package/openPptxPackage'
import type { PptxColorContext, PptxTheme } from '../theme/types'
import type { PptxImportNote } from '../types'

/** A part of the file and where it is. */
export interface PptxPart {
  path: string
  doc: Document
}

/** A slide with the layout and master it is built on. */
export interface PptxSlideParts {
  /** From 1, as PowerPoint numbers it. */
  number: number
  slide: PptxPart
  layout: PptxPart | null
  master: PptxPart | null
  theme: PptxTheme
  color: PptxColorContext
}

/** What every slide of the file is read with. */
export interface PptxDeckContext {
  pkg: PptxPackage
  /** Design pixels per EMU. */
  scale: number
  /** `p:defaultTextStyle`: what a text box that is no placeholder starts from. */
  defaultTextStyle: Element | null
  media: PptxMediaRegistry
}

/** Where the shapes being read are: a slide, its layout or master, a SmartArt drawing. */
export interface PptxShapeContext {
  deck: PptxDeckContext
  parts: PptxSlideParts
  /** The part they are in (its relationships resolve their pictures). */
  partPath: string
  /** Placeholders are drawn only from a slide (or a drawing on it). */
  level: 'slide' | 'layout' | 'master'
  /** Keeps their element ids apart from the slide's own. */
  idPrefix: string
}

/** A summary line of a slide, before it is told which slide it is. */
export type PptxShapeNote = Omit<PptxImportNote, 'slide'>

/** Shapes read: their elements, notes, and the elements each shape id became. */
export interface PptxShapesRead {
  elements: DeckElement[]
  notes: PptxShapeNote[]
  /** Shape id (`cNvPr id`) → element ids, for the animations aimed at it. */
  targets: Map<string, string[]>
}

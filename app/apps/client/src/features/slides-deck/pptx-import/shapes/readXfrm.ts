import type { PptxBox } from './types'
import { xmlChild } from '../xml/xmlChild'
import { xmlNumber } from '../xml/xmlNumber'

/** An `a:xfrm`'s box (off, ext, rot, flips); null when it has no offset or size. */
export function readXfrm(xfrm: Element | null): PptxBox | null {
  const off = xmlChild(xfrm, 'off')
  const ext = xmlChild(xfrm, 'ext')
  if (!off || !ext) return null
  return {
    x: xmlNumber(off, 'x') ?? 0,
    y: xmlNumber(off, 'y') ?? 0,
    w: xmlNumber(ext, 'cx') ?? 0,
    h: xmlNumber(ext, 'cy') ?? 0,
    rotation: (xmlNumber(xfrm, 'rot') ?? 0) / 60_000,
    flipH: xfrm?.getAttribute('flipH') === '1',
    flipV: xfrm?.getAttribute('flipV') === '1',
  }
}

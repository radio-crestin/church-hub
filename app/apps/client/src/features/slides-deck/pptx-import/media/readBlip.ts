import { mediaFileType } from './mediaFileType'
import type { DeckImageElement } from '../../types'
import type { PptxShapeContext, PptxShapeNote } from '../slide/types'
import { xmlChild } from '../xml/xmlChild'
import { xmlNumber } from '../xml/xmlNumber'

/** A picture fill read: its media token, crop and transparency, or why it cannot show. */
export interface PptxBlip {
  mediaId?: string
  crop?: DeckImageElement['crop']
  opacity?: number
  note?: PptxShapeNote
}

const fraction = (value: number | undefined) =>
  Math.min(0.99, Math.max(0, (value ?? 0) / 100_000))

/**
 * A `blipFill`'s picture: registered for upload when a browser can show it
 * (PNG, JPEG, GIF, WebP), with its crop (`a:srcRect`, fractions cut from each
 * side) and transparency (`a:alphaModFix`); EMF, WMF and TIFF cannot show.
 */
export async function readBlip(
  blipFill: Element | null,
  context: PptxShapeContext,
  name: string,
): Promise<PptxBlip> {
  const blip = xmlChild(blipFill, 'blip')
  const embed = blip?.getAttribute('r:embed')
  if (!blip || !embed) {
    return blip?.getAttribute('r:link')
      ? {
          note: {
            outcome: 'skipped',
            reason: 'linkedMedia',
            detail: name || undefined,
          },
        }
      : {}
  }
  const rel = (await context.deck.pkg.rels(context.partPath)).get(embed)
  if (!rel || rel.external || !context.deck.pkg.has(rel.target)) {
    return {
      note: {
        outcome: 'skipped',
        reason: 'linkedMedia',
        detail: name || undefined,
      },
    }
  }
  const type = mediaFileType(rel.target, 'image')
  if (!type.ok) {
    return {
      note: {
        outcome: 'skipped',
        reason: type.reason,
        detail: name || undefined,
      },
    }
  }
  const mediaId = context.deck.media.add({
    path: rel.target,
    kind: 'image',
    mimeType: type.mimeType,
    fileName: `${rel.target
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '')}.${type.extension}`,
  })
  const rect = xmlChild(blipFill, 'srcRect')
  const crop = rect && {
    l: fraction(xmlNumber(rect, 'l')),
    t: fraction(xmlNumber(rect, 't')),
    r: fraction(xmlNumber(rect, 'r')),
    b: fraction(xmlNumber(rect, 'b')),
  }
  const alpha = xmlNumber(xmlChild(blip, 'alphaModFix'), 'amt')
  return {
    mediaId,
    crop:
      crop &&
      crop.l + crop.t + crop.r + crop.b > 0 &&
      crop.l + crop.r < 0.98 &&
      crop.t + crop.b < 0.98
        ? crop
        : undefined,
    opacity: alpha === undefined ? undefined : Math.min(1, alpha / 100_000),
  }
}

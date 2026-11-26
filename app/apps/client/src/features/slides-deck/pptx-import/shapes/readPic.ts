import { emptyRead } from './emptyRead'
import { inheritedPlaceholders } from './inheritedPlaceholders'
import { readXfrm } from './readXfrm'
import { shapeInfo } from './shapeInfo'
import { toDeckBox } from './toDeckBox'
import type { PptxTransform } from './types'
import type { DeckElement } from '../../types'
import { mediaFileType } from '../media/mediaFileType'
import { readBlip } from '../media/readBlip'
import { readMediaPath } from '../media/readMediaPath'
import type { PptxShapeContext, PptxShapesRead } from '../slide/types'
import { xmlChild } from '../xml/xmlChild'

/**
 * A picture (`p:pic`): its image, cropped and see-through as set; or, with a
 * video or sound in it, an MP4/WebM video element with the picture as its
 * poster (a sound: a video with no size, which only plays). A video in
 * another format keeps only its poster ("convert it to MP4"). `frameXfrm`
 * places an OLE object's preview that has no place of its own.
 */
export async function readPic(
  pic: Element,
  transform: PptxTransform,
  context: PptxShapeContext,
  frameXfrm?: Element | null,
): Promise<PptxShapesRead> {
  const read = emptyRead()
  const info = shapeInfo(pic)
  if (info.hidden) return read
  const inherited = inheritedPlaceholders(pic, context)
  const own = readXfrm(
    xmlChild(pic, 'spPr', 'xfrm') ??
      xmlChild(inherited.layout, 'spPr', 'xfrm') ??
      xmlChild(inherited.master, 'spPr', 'xfrm') ??
      frameXfrm ??
      null,
  )
  if (!own) return read
  const base = {
    id: `${context.idPrefix}${info.id}`,
    ...toDeckBox(transform(own), context.deck.scale),
  }
  const blip = await readBlip(xmlChild(pic, 'blipFill'), context, info.name)
  const nvPr = xmlChild(pic, 'nvPicPr', 'nvPr')
  const media = xmlChild(nvPr, 'videoFile')
    ? 'video'
    : xmlChild(nvPr, 'audioFile')
      ? 'audio'
      : null
  let element: DeckElement | null = null

  if (media) {
    const { path, linked } = await readMediaPath(pic, context)
    const type = path ? mediaFileType(path, media) : null
    if (!path || !type) {
      read.notes.push({
        outcome: 'skipped',
        reason: linked ? 'linkedMedia' : 'unsupportedMedia',
        detail: info.name,
      })
    } else if (type.ok) {
      const mediaId = context.deck.media.add({
        path,
        kind: 'video',
        mimeType: type.mimeType,
        fileName: `${path
          .split('/')
          .pop()
          ?.replace(/\.[^.]+$/, '')}.${type.extension}`,
      })
      element =
        media === 'video'
          ? { ...base, type: 'video', mediaId, posterMediaId: blip.mediaId }
          : { ...base, w: 0, h: 0, type: 'video', mediaId }
      if (media === 'audio') {
        read.notes.push({
          outcome: 'changed',
          reason: 'audio',
          detail: info.name,
        })
      }
    } else if (media === 'video' && blip.mediaId) {
      read.notes.push({
        outcome: 'picture',
        reason: type.reason,
        detail: info.name,
      })
      element = { ...base, type: 'image', mediaId: blip.mediaId, fit: 'fill' }
    } else {
      read.notes.push({
        outcome: 'skipped',
        reason: type.reason,
        detail: info.name,
      })
    }
  } else if (blip.mediaId) {
    element = {
      ...base,
      type: 'image',
      mediaId: blip.mediaId,
      fit: 'fill',
      crop: blip.crop,
      opacity: blip.opacity,
    }
  } else if (blip.note) {
    read.notes.push(blip.note)
  }

  if (element) {
    read.elements.push(element)
    read.targets.set(info.id, [element.id])
  }
  return read
}

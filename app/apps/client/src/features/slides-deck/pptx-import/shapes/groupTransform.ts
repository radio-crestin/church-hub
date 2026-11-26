import type { PptxBox, PptxTransform } from './types'
import { xmlChild } from '../xml/xmlChild'
import { xmlNumber } from '../xml/xmlNumber'

/**
 * How a group's children reach the slide: from the group's child space
 * (`a:chOff`/`a:chExt`) scaled into its box, mirrored by its flips and turned
 * by its rotation about its centre, then through the groups around it.
 */
export function groupTransform(
  xfrm: Element | null,
  group: PptxBox,
  outer: PptxTransform,
): PptxTransform {
  const chOff = xmlChild(xfrm, 'chOff')
  const chExt = xmlChild(xfrm, 'chExt')
  const offX = xmlNumber(chOff, 'x') ?? 0
  const offY = xmlNumber(chOff, 'y') ?? 0
  const extW = xmlNumber(chExt, 'cx') || group.w || 1
  const extH = xmlNumber(chExt, 'cy') || group.h || 1
  const sx = group.w / extW
  const sy = group.h / extH
  const gcx = group.x + group.w / 2
  const gcy = group.y + group.h / 2
  const angle = (group.rotation * Math.PI) / 180

  return (child) => {
    let cx = group.x + (child.x + child.w / 2 - offX) * sx
    let cy = group.y + (child.y + child.h / 2 - offY) * sy
    let rotation = child.rotation
    if (group.flipH) {
      cx = 2 * gcx - cx
      rotation = -rotation
    }
    if (group.flipV) {
      cy = 2 * gcy - cy
      rotation = -rotation
    }
    const dx = cx - gcx
    const dy = cy - gcy
    cx = gcx + dx * Math.cos(angle) - dy * Math.sin(angle)
    cy = gcy + dx * Math.sin(angle) + dy * Math.cos(angle)
    const w = child.w * sx
    const h = child.h * sy
    return outer({
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
      rotation: rotation + group.rotation,
      flipH: child.flipH !== group.flipH,
      flipV: child.flipV !== group.flipV,
    })
  }
}

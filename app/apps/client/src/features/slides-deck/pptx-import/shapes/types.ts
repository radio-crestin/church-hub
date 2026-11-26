/** A shape's box in EMU, rotated clockwise in degrees about its centre. */
export interface PptxBox {
  x: number
  y: number
  w: number
  h: number
  rotation: number
  flipH: boolean
  flipV: boolean
}

/** Takes a box from a group's own coordinates to the slide's. */
export type PptxTransform = (box: PptxBox) => PptxBox

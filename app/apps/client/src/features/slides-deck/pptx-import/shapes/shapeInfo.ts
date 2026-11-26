import { xmlChild } from '../xml/xmlChild'

const NON_VISUAL = [
  'nvSpPr',
  'nvPicPr',
  'nvCxnSpPr',
  'nvGrpSpPr',
  'nvGraphicFramePr',
]

/**
 * A shape's id (what animations aim at), name and whether it is hidden. A
 * SmartArt drawing's shapes all have id 0: theirs is their `modelId`.
 */
export function shapeInfo(shape: Element): {
  id: string
  name: string
  hidden: boolean
} {
  const props = NON_VISUAL.map((name) => xmlChild(shape, name, 'cNvPr')).find(
    Boolean,
  )
  const id = props?.getAttribute('id') ?? ''
  const model = shape.getAttribute('modelId')?.replace(/[{}]/g, '')
  return {
    id: (id === '0' || !id) && model ? model : id,
    name: props?.getAttribute('name') ?? '',
    hidden: props?.getAttribute('hidden') === '1',
  }
}

import { getElementLabel } from './getElementLabel'
import { getElementPath } from './getElementPath'
import { getElementSelector } from './getElementSelector'
import type { PickedElement } from '../types'

export function describePickedElement(element: Element): PickedElement {
  return {
    selector: getElementSelector(element),
    path: getElementPath(element),
    label: getElementLabel(element),
  }
}

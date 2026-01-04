import type { ReferenceWrapperStyle } from '../types'

export function formatReferenceWithWrapper(
  reference: string,
  wrapperStyle: ReferenceWrapperStyle = 'none',
): string {
  switch (wrapperStyle) {
    case 'parentheses':
      return `(${reference})`
    case 'brackets':
      return `[${reference}]`
    case 'none':
    default:
      return reference
  }
}

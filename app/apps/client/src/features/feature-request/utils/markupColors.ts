/** The markup palette, like iPad Markup: few, clear colours. Red first. */
export const MARKUP_COLORS = [
  { value: '#ef4444', nameKey: 'common:featureRequest.colorRed' },
  { value: '#facc15', nameKey: 'common:featureRequest.colorYellow' },
  { value: '#22c55e', nameKey: 'common:featureRequest.colorGreen' },
  { value: '#3b82f6', nameKey: 'common:featureRequest.colorBlue' },
  { value: '#111827', nameKey: 'common:featureRequest.colorBlack' },
  { value: '#ffffff', nameKey: 'common:featureRequest.colorWhite' },
] as const

export const DEFAULT_MARKUP_COLOR: string = MARKUP_COLORS[0].value

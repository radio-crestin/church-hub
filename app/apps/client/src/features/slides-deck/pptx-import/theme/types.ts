/** A colour as read from the file, its alpha from 0 to 1. */
export interface PptxRgba {
  r: number
  g: number
  b: number
  a: number
}

/** What a slide's theme gives the shapes on it. */
export interface PptxTheme {
  /** `dk1`, `lt1`, `accent1`… as `rrggbb`. */
  colors: Record<string, string>
  /** The heading (`+mj-lt`) and body (`+mn-lt`) fonts. */
  majorFont: string
  minorFont: string
  /** The style matrix: `bgRef idx` 1001… and `fillRef idx` 1… pick from these. */
  backgroundFills: Element[]
  fills: Element[]
  /** `lnRef idx` 1… picks a line width (EMU). */
  lineWidths: number[]
}

/** How a colour in a part is read: the theme, its master's colour map, a style's placeholder colour. */
export interface PptxColorContext {
  theme: PptxTheme
  /** `bg1` → `lt1`, `tx1` → `dk1`, … (the master's `p:clrMap`). */
  colorMap: Record<string, string>
  /** What `phClr` stands for, inside a style reference. */
  placeholderColor?: PptxRgba
}

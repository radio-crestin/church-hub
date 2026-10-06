/** OpenSong metadata fields. */
export interface OpenSongMetadata {
  author: string | null
  copyright: string | null
  ccli: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  churchHubId: number | null
  /** The file the song first came from (Church Hub song files carry it). */
  sourceFilename: string | null
}

/** One slide of a parsed song, with its verse label (V1, C, B…). */
export interface ParsedSlideWithLabel {
  slideNumber: number
  text: string
  htmlContent: string
  label?: string | null
}

/** A verse of OpenSong lyrics: its label and its lines. */
export interface ParsedOpenSongVerse {
  label: string
  lines: string[]
}

/** A song read from a source file, ready to compare or import. */
export interface ParsedOpenSong {
  title: string
  slides: ParsedSlideWithLabel[]
  metadata: OpenSongMetadata
  verses: ParsedOpenSongVerse[]
}

/** One song's OpenSong file in a song bundle. */
export interface SongBundleFile {
  id: string
  path: string
  xml: string
}

/** A song of a song source, with the source's own id for it. */
export interface SourceSong {
  id: string
  /** The file the song came from, which the library matches by. */
  sourceFilename: string | null
  parsed: ParsedOpenSong
}

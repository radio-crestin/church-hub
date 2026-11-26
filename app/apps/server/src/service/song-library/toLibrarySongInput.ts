import {
  type LibrarySongInput,
  parseOpenSongXml,
} from '@church-hub/song-formats'

/** A submitted OpenSong file as a library song with this id. */
export function toLibrarySongInput(id: string, xml: string): LibrarySongInput {
  const parsed = parseOpenSongXml(xml, undefined, { exactTitle: true })
  return {
    id,
    title: parsed.title,
    xml,
    lyrics: parsed.slides.map((slide) => slide.text),
  }
}

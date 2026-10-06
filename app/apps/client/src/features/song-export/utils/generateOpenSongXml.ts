import {
  htmlToPlainText,
  type OpenSongVerse,
  writeOpenSongXml,
} from '@church-hub/song-formats'

import type { SongWithSlides } from '~/features/songs/types'
import { generateExpandedPresentationOrder } from '~/features/songs/utils/expandSongSlides'

/**
 * The slides as OpenSong verses, each under its own label, with "Amin!"
 * added to the last slide when the song doesn't end with it.
 */
function slidesToVerses(slides: SongWithSlides['slides']): OpenSongVerse[] {
  return (slides ?? []).map((slide, index) => {
    let text = htmlToPlainText(slide.content)
    const isLastSlide = index === slides.length - 1
    if (isLastSlide && text && !/amin/i.test(text)) text = `${text}\n\nAmin!`
    return { label: slide.label ?? null, lines: text.split('\n') }
  })
}

/**
 * Generates OpenSong XML from a SongWithSlides object
 * This is the inverse of parseOpenSongXml
 */
export function generateOpenSongXml(song: SongWithSlides): string {
  // Presentation order with chorus insertions (C1 V1 C1 V2 C1 V3 C2...)
  const presentationOrder = generateExpandedPresentationOrder(song.slides)
  return writeOpenSongXml({
    title: song.title,
    fields: {
      church_hub_id: String(song.id),
      author: song.author,
      copyright: song.copyright,
      ccli: song.ccli,
      tempo: song.tempo,
      timesig: song.timeSignature,
      theme: song.theme,
      alttheme: song.altTheme,
      hymn_number: song.hymnNumber,
      key_line: song.keyLine,
      presentation: presentationOrder || song.presentationOrder,
    },
    verses: slidesToVerses(song.slides),
  })
}

import { htmlToPlainText } from '@church-hub/song-formats'

import type { SharedSongInput, SharedSongSlide } from './types'
import type { SongWithSlides } from '../songs/types'

/**
 * A slide's lines, each word with its chord. Chords are kept by word
 * position, a line break taking one too, as the projector counts them
 * (ChordsOverlay).
 */
function toSlide(slide: SongWithSlides['slides'][number]): SharedSongSlide {
  const chords = new Map(
    (slide.chords ?? []).map((mapping) => [mapping.wordIndex, mapping.chord]),
  )
  let position = 0
  const lines = htmlToPlainText(slide.content)
    .split('\n')
    .map((line) => {
      const words = line.split(/\s+/).filter(Boolean)
      const shared = words.map((word) => {
        const chord = chords.get(position++)
        return chord ? { word, chord } : { word }
      })
      position++
      return shared
    })
  return { label: slide.label, lines }
}

/** The song as its public page shows it. */
export function toSharedSong(song: SongWithSlides): SharedSongInput {
  return {
    title: song.title,
    author: song.author,
    copyright: song.copyright,
    keyLine: song.keyLine,
    slides: [...song.slides]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toSlide),
  }
}

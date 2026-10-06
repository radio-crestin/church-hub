import {
  slidesToOpenSongVerses,
  writeOpenSongXml,
} from '@church-hub/song-formats'

import type { CategorySong } from './readCategorySongs'

/**
 * A song as an OpenSong file that gives back the same slides in the same
 * order (see slidesToOpenSongVerses), with our own fields: hymn number, key
 * line and the file the song first came from.
 */
export function songToOpenSong(song: CategorySong): string {
  const { verses, presentation } = slidesToOpenSongVerses(song.slides)
  return writeOpenSongXml({
    title: song.title,
    fields: {
      author: song.author,
      copyright: song.copyright,
      ccli: song.ccli,
      tempo: song.tempo,
      timesig: song.timeSignature,
      theme: song.theme,
      alttheme: song.altTheme,
      hymn_number: song.hymnNumber,
      key_line: song.keyLine,
      source_filename: song.sourceFilename,
      presentation,
    },
    verses,
  })
}

import type { SourceSong } from '@church-hub/song-formats'

import {
  type BatchImportSongInput,
  batchImportSongs,
  batchUpdateSearchIndex,
  getAllCategories,
  upsertCategory,
} from '../../songs'
import type { SongSource } from '../types'

function toBatchSong({
  parsed,
  sourceFilename,
}: SourceSong): BatchImportSongInput {
  const { metadata } = parsed
  return {
    title: parsed.title,
    sourceFilename,
    author: metadata.author,
    copyright: metadata.copyright,
    ccli: metadata.ccli,
    tempo: metadata.tempo,
    timeSignature: metadata.timeSignature,
    theme: metadata.theme,
    altTheme: metadata.altTheme,
    hymnNumber: metadata.hymnNumber,
    keyLine: metadata.keyLine,
    presentationOrder: metadata.presentationOrder,
    slides: parsed.slides.map((slide, index) => ({
      content: slide.htmlContent,
      sortOrder: index,
      label: slide.label ?? null,
    })),
  }
}

/** The source's category, created the first time a source adds songs. */
function sourceCategoryId(source: SongSource): number | null {
  const existing = getAllCategories().find(
    (category) => category.name === source.categoryName,
  )
  return (
    existing?.id ?? upsertCategory({ name: source.categoryName })?.id ?? null
  )
}

/** Adds songs to the library in the source's category; returns how many. */
export function importSourceSongs(
  source: SongSource,
  songs: SourceSong[],
): number {
  if (songs.length === 0) return 0
  const result = batchImportSongs(
    songs.map(toBatchSong),
    sourceCategoryId(source),
    false,
    false,
  )
  batchUpdateSearchIndex(result.songIds)
  return result.successCount
}

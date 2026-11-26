import type { ScreenBackgroundConfig } from '~/features/presentation/types'
import type { SongMetadata } from '../components/SongDetailsSection'
import type { LocalSlide, SongWithSlides } from '../types'

/** Everything the song editor edits, as it holds it. */
export interface SongDraft {
  title: string
  categoryId: number | null
  tagIds: number[]
  slides: LocalSlide[]
  metadata: SongMetadata
  /** The song's own background; null = the screens' own ones apply. */
  background: ScreenBackgroundConfig | null
}

/** A stored song as the editor's draft. */
export function songToDraft(song: SongWithSlides): SongDraft {
  return {
    title: song.title,
    categoryId: song.categoryId,
    tagIds: song.tags.map((tag) => tag.id),
    slides: song.slides.map((s) => ({
      id: s.id,
      content: s.content,
      chords: s.chords,
      sortOrder: s.sortOrder,
      label: s.label,
      notes: s.notes,
      styleOverrides: s.styleOverrides,
    })),
    metadata: {
      author: song.author,
      copyright: song.copyright,
      ccli: song.ccli,
      tempo: song.tempo,
      timeSignature: song.timeSignature,
      theme: song.theme,
      altTheme: song.altTheme,
      hymnNumber: song.hymnNumber,
      keyLine: song.keyLine,
      presentationOrder: song.presentationOrder,
      sourceFilename: song.sourceFilename,
    },
    background: song.background,
  }
}

import type { SongDraft } from './songToDraft'

/**
 * What tells one draft from another: everything a save would store, slides by
 * position (their sortOrder is their place). Tags are a set.
 */
export function draftSignature(draft: SongDraft): string {
  return JSON.stringify({
    title: draft.title,
    categoryId: draft.categoryId,
    tagIds: [...draft.tagIds].sort((a, b) => a - b),
    slides: draft.slides.map((s) => [
      s.content,
      s.chords ?? null,
      s.label ?? null,
      s.notes ?? null,
      s.styleOverrides ?? null,
    ]),
    metadata: draft.metadata,
    background: draft.background ?? null,
  })
}

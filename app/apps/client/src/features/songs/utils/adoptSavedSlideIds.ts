/**
 * Puts the ids a save came back with onto the editor's draft.
 *
 * A slide added on the stage carries a `temp-…` id until it is stored. Keeping
 * that id past the save means every later save sends the slide as new again —
 * the server inserts a fresh row and deletes the one before it — and anything
 * that recognises slides by id never recognises this one.
 *
 * The save sends the draft in order with `sortOrder` set to each position, and
 * the server answers in `sortOrder`, so `sent[i]` and `saved[i]` are the same
 * slide. Only ids change: text typed while the save was in flight stays as it
 * is. Lists of different lengths cannot be paired, so the draft is left alone.
 */
export function adoptSavedSlideIds<T extends { id: string | number }>(
  draft: T[],
  sent: ReadonlyArray<{ id: string | number }>,
  saved: ReadonlyArray<{ id: number }>,
): T[] {
  if (sent.length !== saved.length) return draft

  const savedIdBySentId = new Map<string | number, number>()
  sent.forEach((slide, index) => {
    if (slide.id !== saved[index].id) {
      savedIdBySentId.set(slide.id, saved[index].id)
    }
  })
  if (savedIdBySentId.size === 0) return draft

  return draft.map((slide) => {
    const savedId = savedIdBySentId.get(slide.id)
    return savedId === undefined ? slide : { ...slide, id: savedId }
  })
}

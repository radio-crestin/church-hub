import { type RefObject, useEffect, useRef } from 'react'

/**
 * Scrolls `containerRef` to its bottom whenever `ids` gains an entry, so a row
 * just appended to the list (a bookmark, a note) comes into view instead of
 * landing below the fold. The ids seen on the first `ready` render are the
 * baseline: loading the list never scrolls it.
 */
export function useScrollToBottomOnAdd(
  ids: readonly string[],
  containerRef: RefObject<HTMLElement | null>,
  ready: boolean,
) {
  const knownIds = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!ready) return
    const previous = knownIds.current
    knownIds.current = new Set(ids)
    if (!previous || ids.every((id) => previous.has(id))) return
    const container = containerRef.current
    container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [ids, containerRef, ready])
}

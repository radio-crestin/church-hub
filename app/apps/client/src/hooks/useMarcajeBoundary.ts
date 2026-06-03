import { useCallback } from 'react'

import { DIVIDER_KEYS, SONG_DETAIL_DEFAULTS } from '~/service/layout'
import { useDividerPosition } from './useDividerPosition'

// The song-detail right divider (Stage vs Marcaje, as a % of the right-of-slides
// area) can be dragged within this range — mirror it so a songs-list drag can
// never push the shared value outside what the detail page allows.
const RIGHT_MIN = 20
const RIGHT_MAX = 70

/**
 * The page-relative percentage at which the Marcaje column begins, derived from
 * the song-detail layout's Slides (`left`) and Stage (`right`) dividers:
 *
 *   boundary = left + (100 - left) * right / 100
 */
function boundaryFrom(left: number, right: number): number {
  return left + ((100 - left) * right) / 100
}

/** Inverse of `boundaryFrom`: the `right` divider value that lands the Marcaje
 *  edge at `boundary`, given a fixed `left`. */
function rightFor(boundary: number, left: number): number {
  if (left >= 100) return RIGHT_MAX
  return ((boundary - left) / (100 - left)) * 100
}

/**
 * Single source of truth for where the Marcaje column starts, shared by the
 * song-detail page and the songs-list page so the Marcaje edge sits at the SAME
 * horizontal position on both. It is backed by the song-detail Slides + Stage
 * dividers (`songDetailLeft` / `songDetailRight` in `localStorage`):
 *
 *  - reading returns the derived boundary, so the songs-list page always opens
 *    aligned with the song page's current layout;
 *  - setting (e.g. dragging the songs-list divider) keeps Slides fixed and
 *    rewrites the Stage divider, so the song page follows in lock-step.
 *
 * Drop-in compatible with `useDividerPosition`'s `[value, setValue]` shape.
 */
export function useMarcajeBoundary(): [number, (boundary: number) => void] {
  const [left] = useDividerPosition(
    DIVIDER_KEYS.songDetailLeft,
    SONG_DETAIL_DEFAULTS.left,
  )
  const [right, setRight] = useDividerPosition(
    DIVIDER_KEYS.songDetailRight,
    SONG_DETAIL_DEFAULTS.right,
  )

  const setBoundary = useCallback(
    (boundary: number) => {
      const nextRight = rightFor(boundary, left)
      setRight(Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, nextRight)))
    },
    [left, setRight],
  )

  return [boundaryFrom(left, right), setBoundary]
}

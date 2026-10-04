import { useEffect, useState } from 'react'

/** Tailwind's `lg` breakpoint: where panels become movable columns. */
const LARGE_SCREEN_MIN_WIDTH_PX = 1024

const isLarge = () =>
  typeof window !== 'undefined' &&
  window.innerWidth >= LARGE_SCREEN_MIN_WIDTH_PX

/** `true` while the window is at least as wide as Tailwind's `lg` breakpoint. */
export function useIsLargeScreen(): boolean {
  const [large, setLarge] = useState(isLarge)

  useEffect(() => {
    const update = () => setLarge(isLarge())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return large
}

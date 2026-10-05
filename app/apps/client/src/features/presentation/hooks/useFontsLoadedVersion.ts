import { useEffect, useState } from 'react'

/**
 * A number that grows each time the page finishes loading web fonts. Bundled
 * fonts load lazily, the first time text uses them, so text measured before
 * that was measured in a fallback font; depending on this number re-measures
 * it once the real font is in.
 */
export function useFontsLoadedVersion(): number {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts
    if (!fonts) return
    const bump = () => setVersion((current) => current + 1)
    fonts.addEventListener('loadingdone', bump)
    // Fonts that finished between the first render and this effect.
    fonts.ready.then(bump)
    return () => fonts.removeEventListener('loadingdone', bump)
  }, [])

  return version
}

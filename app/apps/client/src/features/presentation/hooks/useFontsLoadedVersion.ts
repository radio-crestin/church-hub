import { useEffect, useState } from 'react'

import { getFontFamilyStack } from '../utils/getFontFamilyStack'

/** A font family's name as a stack or a FontFace gives it, compared as such. */
const familyName = (family: string) =>
  family
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .toLowerCase()

/**
 * A number that grows each time the page finishes loading a web font the text
 * draws with. Bundled fonts load lazily, the first time text uses them, so text
 * measured before that was measured in a fallback font; depending on this
 * number re-measures it once the real font is in.
 *
 * A font of another family (the "Amin!" under a song's last slide loads its own
 * the first time it shows) changes nothing in this text, so it doesn't bump the
 * number: re-measuring the slide then would lay its text out again in the
 * middle of the slide change. Without `fontFamily`, every font counts.
 */
export function useFontsLoadedVersion(fontFamily?: string | null): number {
  const [version, setVersion] = useState(0)
  const stack = getFontFamilyStack(fontFamily)

  useEffect(() => {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts
    if (!fonts) return
    const families = stack ? new Set(stack.split(',').map(familyName)) : null
    const bump = () => setVersion((current) => current + 1)
    const onLoaded = (event: FontFaceSetLoadEvent) => {
      const drawn = event.fontfaces.some(
        (face) => !families || families.has(familyName(face.family)),
      )
      if (drawn) bump()
    }
    fonts.addEventListener('loadingdone', onLoaded)
    // Fonts that finished between the first render and this effect.
    fonts.ready.then(bump)
    return () => fonts.removeEventListener('loadingdone', onLoaded)
  }, [stack])

  return version
}

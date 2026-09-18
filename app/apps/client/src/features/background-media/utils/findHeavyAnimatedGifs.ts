import { type AnimatedGifCheck, isHeavyAnimatedGif } from './isHeavyAnimatedGif'
import { validateBackgroundMediaFile } from './validateBackgroundMediaFile'

/** A picked GIF too heavy to play well, as the upload warning lists it. */
export interface HeavyAnimatedGif extends AnimatedGifCheck {
  name: string
}

/**
 * The picked files that are heavy animated GIFs. Files the upload refuses
 * anyway (wrong type, too large) are not read. One file at a time, so a pick
 * of many large GIFs never holds more than one of them in memory.
 */
export async function findHeavyAnimatedGifs(
  files: File[],
): Promise<HeavyAnimatedGif[]> {
  const heavyGifs: HeavyAnimatedGif[] = []
  for (const file of files) {
    if (validateBackgroundMediaFile(file)) continue
    const check = await isHeavyAnimatedGif(file)
    if (check?.heavy) heavyGifs.push({ ...check, name: file.name })
  }
  return heavyGifs
}

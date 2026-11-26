import { createHash } from 'node:crypto'

/** A song's slides as published, or as kept: content and label, in order. */
export function slidesFingerprint(
  slides: { content: string; label: string | null | undefined }[],
): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        slides.map((slide) => [slide.content, slide.label ?? null]),
      ),
    )
    .digest('hex')
}

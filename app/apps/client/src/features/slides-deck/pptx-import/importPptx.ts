import { swapDeckMedia } from './media/swapDeckMedia'
import { uploadPptxMedia } from './media/uploadPptxMedia'
import { parsePptxDeck } from './parsePptxDeck'
import type { PptxImportProgress, PptxImportResult } from './types'

/**
 * A PowerPoint file as a deck ready to save: read in the browser, its
 * pictures and videos uploaded to the gallery, with the summary of what did
 * not come in as it is. Throws when the file cannot be read.
 */
export async function importPptx(
  file: File,
  onProgress: (progress: PptxImportProgress) => void,
): Promise<PptxImportResult> {
  onProgress({ phase: 'reading' })
  const parsed = await parsePptxDeck(file, file.name)
  const { uploaded, tooLarge, failed } = await uploadPptxMedia(
    parsed.pkg,
    parsed.media,
    (done, total) => onProgress({ phase: 'uploading', done, total }),
  )
  const deck = swapDeckMedia(parsed.deck, uploaded)
  const elements = deck.slides.flatMap((slide) => slide.elements)
  return {
    deck,
    notes: [
      ...parsed.notes,
      ...tooLarge.map((detail) => ({
        outcome: 'skipped' as const,
        reason: 'mediaTooLarge' as const,
        detail,
      })),
      ...failed.map((detail) => ({
        outcome: 'skipped' as const,
        reason: 'uploadFailed' as const,
        detail,
      })),
    ],
    pictures: elements.filter(
      (e) => e.type === 'image' || e.type === 'picture_fallback',
    ).length,
    videos: elements.filter((e) => e.type === 'video').length,
  }
}

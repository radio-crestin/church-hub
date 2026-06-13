import { useBatchImportSongs } from '~/features/song-import'
import type { StagingItem } from '../types'

/** Maps an approved staging item's edited draft to a batch-import song. */
function draftToBatchSong(item: StagingItem) {
  const { draft, candidate } = item
  return {
    title: draft.title.trim(),
    slides: draft.slides.map((slide, idx) => ({
      content: slide.content,
      sortOrder: idx,
      label: slide.label ?? null,
    })),
    sourceFilename: candidate.sourceFilename,
    author: draft.metadata.author,
    copyright: draft.metadata.copyright,
    ccli: draft.metadata.ccli,
    tempo: draft.metadata.tempo,
    timeSignature: draft.metadata.timeSignature,
    theme: draft.metadata.theme,
    altTheme: draft.metadata.altTheme,
    hymnNumber: draft.metadata.hymnNumber,
    keyLine: draft.metadata.keyLine,
    presentationOrder: draft.metadata.presentationOrder,
  }
}

/**
 * Imports the approved staging items by reusing the existing batch-import
 * pipeline. Items are grouped by their (possibly edited) target category so a
 * single approve set can span categories. `overwriteDuplicates` stays false —
 * discovery already filtered out everything already in the library, so the
 * server's insert/skip dedup is just a harmless safety net.
 */
export function useImportApproved() {
  const { batchImport, isPending, progress } = useBatchImportSongs()

  const importApproved = async (approved: StagingItem[]): Promise<number[]> => {
    if (approved.length === 0) return []

    // Group by target category — batchImport takes one categoryId per call.
    const byCategory = new Map<number | null, StagingItem[]>()
    for (const item of approved) {
      const key = item.draft.categoryId
      const bucket = byCategory.get(key)
      if (bucket) bucket.push(item)
      else byCategory.set(key, [item])
    }

    const importedIds: number[] = []
    for (const [categoryId, items] of byCategory) {
      const result = await batchImport(
        { songs: items.map(draftToBatchSong), categoryId },
        { overwriteDuplicates: false, skipManuallyEdited: false },
      )
      importedIds.push(...result.songIds)
    }

    return importedIds
  }

  return { importApproved, isPending, progress }
}

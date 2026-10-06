import { useQueryClient } from '@tanstack/react-query'

import { useUpsertCategory } from '~/features/songs/hooks'
import { useImportApproved } from './useImportApproved'
import type { SongSource } from '../providers'
import type { StagingItem } from '../types'

/**
 * Imports the picked songs: a song with no category goes to its source's
 * category, created the first time. Returns the imported songs' tempIds.
 */
export function useImportSelected(sources: SongSource[]) {
  const queryClient = useQueryClient()
  const { mutateAsync: upsertCategory } = useUpsertCategory()
  const { importApproved, isPending } = useImportApproved()

  const sourceCategoryId = async (sourceId: string) => {
    const name = sources.find((s) => s.id === sourceId)?.categoryName
    if (!name) return null
    const created = await upsertCategory({ name })
    return created.success ? (created.category?.id ?? null) : null
  }

  const importSelected = async (items: StagingItem[]): Promise<string[]> => {
    const categoryBySource = new Map<string, number | null>()
    const ready: StagingItem[] = []
    for (const item of items) {
      if (item.draft.categoryId != null) {
        ready.push(item)
        continue
      }
      if (!categoryBySource.has(item.sourceId)) {
        categoryBySource.set(
          item.sourceId,
          await sourceCategoryId(item.sourceId),
        )
      }
      const categoryId = categoryBySource.get(item.sourceId) ?? null
      ready.push({ ...item, draft: { ...item.draft, categoryId } })
    }
    await importApproved(ready)
    queryClient.invalidateQueries({ queryKey: ['songs'] })
    return ready.map((item) => item.tempId)
  }

  return { importSelected, isImporting: isPending }
}

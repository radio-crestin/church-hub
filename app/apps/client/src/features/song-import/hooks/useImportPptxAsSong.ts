import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useUpsertSong } from '~/features/songs/hooks'
import type { ParsedPptx } from '../utils/parsePptx'

/**
 * Hook to directly import a parsed PPTX as a song and navigate to the song page
 */
export function useImportPptxAsSong() {
  const navigate = useNavigate()
  const upsertMutation = useUpsertSong()

  const importAsSong = useCallback(
    async (parsedPptx: ParsedPptx, sourceFilename: string | null) => {
      const result = await upsertMutation.mutateAsync({
        title: parsedPptx.title,
        sourceFilename,
        slides: parsedPptx.slides.map((slide, idx) => ({
          content: slide.htmlContent,
          sortOrder: idx,
        })),
      })

      if (result.success && result.data) {
        navigate({
          to: '/songs/$songId',
          params: { songId: String(result.data.id) },
        })
        return result.data.id
      }

      return null
    },
    [navigate, upsertMutation],
  )

  return {
    importAsSong,
    isPending: upsertMutation.isPending,
  }
}

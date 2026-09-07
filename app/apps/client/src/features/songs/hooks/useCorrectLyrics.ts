import { useMutation } from '@tanstack/react-query'

import { correctLyrics } from '../service/lyricsCorrection'

/** Proof-reads a passage of lyrics. */
export function useCorrectLyrics() {
  return useMutation({
    mutationFn: (text: string) => correctLyrics(text),
  })
}

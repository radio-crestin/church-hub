import { fetcher } from '../../../utils/fetcher'

export interface LyricsCorrection {
  /** The corrected passage, with the same line structure it went in with. */
  text: string
  /** False when nothing needed correcting. */
  changed: boolean
}

/**
 * Proof-reads a passage of lyrics on the server, which holds the AI provider
 * and key the song search already uses.
 */
export async function correctLyrics(text: string): Promise<LyricsCorrection> {
  const response = await fetcher<{
    data?: LyricsCorrection
    error?: string
  }>('/api/songs/correct-lyrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (response.error || !response.data) {
    throw new Error(response.error ?? 'Correction failed')
  }
  return response.data
}

import { fetcher } from '~/utils/fetcher'
import type { SongGroup } from '../types'

interface ApiResponse<T> {
  data?: T | null
  error?: string
}

/**
 * Returns the group a song belongs to, or `null` when the song is
 * standalone. Standalone songs are their own canonical version.
 */
export async function getGroupForSong(
  songId: number,
): Promise<SongGroup | null> {
  const response = await fetcher<ApiResponse<SongGroup>>(
    `/api/songs/${songId}/group`,
  )
  return response.data ?? null
}

export async function getSongGroup(groupId: number): Promise<SongGroup | null> {
  const response = await fetcher<ApiResponse<SongGroup>>(
    `/api/song-groups/${groupId}`,
  )
  return response.data ?? null
}

/**
 * Marks two songs as versions of the same underlying piece. Idempotent:
 * calling it on two songs already in the same group is a no-op.
 *
 * Resolves to the resulting group; throws on failure.
 */
export async function linkSongs(
  songIdA: number,
  songIdB: number,
): Promise<SongGroup> {
  const response = await fetcher<ApiResponse<SongGroup>>(
    '/api/song-groups/link',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songIdA, songIdB }),
    },
  )
  if (response.error || !response.data) {
    throw new Error(response.error ?? 'Failed to link songs')
  }
  return response.data
}

/**
 * Marks a song as the primary member of its group. The song must already be
 * a member.
 */
export async function setPrimarySong(
  groupId: number,
  songId: number,
): Promise<SongGroup> {
  const response = await fetcher<ApiResponse<SongGroup>>(
    `/api/song-groups/${groupId}/primary`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId }),
    },
  )
  if (response.error || !response.data) {
    throw new Error(response.error ?? 'Failed to set primary')
  }
  return response.data
}

/**
 * Detaches a song from its group ("Not the same song"). If the song was the
 * primary, another member is promoted; a single-member group is collapsed
 * back into a standalone song.
 */
export async function unlinkSong(songId: number): Promise<void> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/songs/${songId}/group`,
    { method: 'DELETE' },
  )
  if (response.error) {
    throw new Error(response.error)
  }
}

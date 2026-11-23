import { useMusicFiles } from './useMusicFiles'
import { usePlaylist } from './usePlaylists'
import type { LibraryTrack, LibraryView } from '../types'

/**
 * The tracks of the chosen view. A search looks through the whole library,
 * whichever view is chosen.
 */
export function useLibraryTracks(
  view: LibraryView,
  search: string,
): { tracks: LibraryTrack[]; isLoading: boolean } {
  const isSearching = search.length > 0
  const playlistId = !isSearching && view.kind === 'playlist' ? view.id : null

  const files = useMusicFiles({
    search: isSearching ? search : undefined,
    folderId: !isSearching && view.kind === 'folder' ? view.id : undefined,
    recent: !isSearching && view.kind === 'recent',
    enabled: playlistId === null,
  })
  const playlist = usePlaylist(playlistId)

  if (playlistId !== null) {
    return {
      tracks: (playlist.data?.items ?? []).map((item) => ({
        ...item.file,
        playlistItemId: item.id,
      })),
      isLoading: playlist.isLoading,
    }
  }
  return { tracks: files.data ?? [], isLoading: files.isLoading }
}

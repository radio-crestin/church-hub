import { getYouTubeService, youtubeApiFetch } from './client'

export interface YouTubePlaylist {
  id: string
  title: string
  description: string
  itemCount: number
  thumbnailUrl?: string
}

interface YouTubePlaylistItem {
  id: string
  snippet?: {
    title?: string
    description?: string
    thumbnails?: {
      default?: { url?: string }
    }
  }
  contentDetails?: {
    itemCount?: number
  }
}

interface YouTubePlaylistListResponse {
  items?: YouTubePlaylistItem[]
}

export async function getPlaylists(): Promise<YouTubePlaylist[]> {
  const youtube = await getYouTubeService()

  if (youtube) {
    const response = await youtube.playlists.list({
      part: ['snippet', 'contentDetails'],
      mine: true,
      maxResults: 50,
    })

    return (response.data.items || []).map((playlist) => ({
      id: playlist.id!,
      title: playlist.snippet?.title || '',
      description: playlist.snippet?.description || '',
      itemCount: playlist.contentDetails?.itemCount || 0,
      thumbnailUrl: playlist.snippet?.thumbnails?.default?.url,
    }))
  }

  // Fallback to direct API fetch
  const response = await youtubeApiFetch<YouTubePlaylistListResponse>(
    'playlists',
    {
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '50',
    },
  )

  return (response.items || []).map((playlist) => ({
    id: playlist.id,
    title: playlist.snippet?.title || '',
    description: playlist.snippet?.description || '',
    itemCount: playlist.contentDetails?.itemCount || 0,
    thumbnailUrl: playlist.snippet?.thumbnails?.default?.url,
  }))
}

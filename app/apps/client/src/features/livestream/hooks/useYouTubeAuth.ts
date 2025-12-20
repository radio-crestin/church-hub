import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import {
  getYouTubeAuthStatus,
  getYouTubeAuthUrl,
  logoutYouTube,
} from '../service'

export function useYouTubeAuth() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['livestream', 'youtube', 'auth'],
    queryFn: getYouTubeAuthStatus,
    staleTime: 5 * 60 * 1000,
  })

  const logoutMutation = useMutation({
    mutationFn: logoutYouTube,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestream', 'youtube'] })
    },
  })

  const openLoginPopup = useCallback(async () => {
    const authUrl = await getYouTubeAuthUrl()
    const popup = window.open(
      authUrl,
      'youtube-auth',
      'width=600,height=700,left=100,top=100',
    )

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'youtube-auth-success') {
        queryClient.invalidateQueries({ queryKey: ['livestream', 'youtube'] })
        popup?.close()
      } else if (event.data?.type === 'youtube-auth-error') {
        popup?.close()
      }
    }

    window.addEventListener('message', handleMessage)

    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed)
        window.removeEventListener('message', handleMessage)
      }
    }, 500)
  }, [queryClient])

  return {
    ...query,
    isAuthenticated: query.data?.isAuthenticated ?? false,
    channelName: query.data?.channelName,
    channelId: query.data?.channelId,
    login: openLoginPopup,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  }
}

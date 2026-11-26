import type { APIRequestContext, APIResponse } from '@playwright/test'

/**
 * Connects a YouTube channel the way a finished sign-in does: starts the
 * sign-in for its state, then stores the tokens with it.
 */
export async function connectYouTube(
  api: APIRequestContext,
  tokens: {
    accessToken: string
    refreshToken: string
    expiresAt: number
    channelName?: string
  },
): Promise<APIResponse> {
  const signIn = await api.post('/api/livestream/youtube/sign-in')
  const { state } = (await signIn.json()).data as { state: string }
  return api.post('/api/livestream/youtube/tokens', {
    data: { state, ...tokens },
  })
}

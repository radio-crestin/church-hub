import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { getApiUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import { createLogger } from '~/utils/logger'
import type {
  ContentType,
  ContentTypeConfig,
  NextSlideSectionConfig,
  Screen,
  ScreenGlobalSettings,
  ScreenWithConfigs,
  UpsertScreenInput,
} from '../types'

const logger = createLogger('screens-service')

// Check if we're running in Tauri context
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Use Tauri fetch on mobile (iOS WKWebView blocks HTTP fetch)
const fetchFn = isTauri && isMobile() ? tauriFetch : window.fetch.bind(window)

// Get headers with auth token for mobile
function getHeaders(contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  // Mobile sends the auth token as a Cookie (Tauri HTTP plugin); desktop Tauri
  // sends it as X-User-Auth (window.fetch forbids Cookie, and macOS WKWebView
  // won't store the cross-site Secure cookie). Browser uses the same-origin
  // cookie, so no header is needed.
  if (isTauri) {
    const userToken = getStoredUserToken()
    if (userToken) {
      if (isMobile()) {
        headers['Cookie'] = `user_auth=${userToken}`
      } else {
        headers['X-User-Auth'] = userToken
      }
    }
  }
  return headers
}

/**
 * Fetches all screens
 */
export async function getAllScreens(): Promise<Screen[]> {
  logger.debug('Fetching all screens')

  const response = await fetchFn(`${getApiUrl()}/api/screens`, {
    credentials: 'include',
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch screens')
  }

  const result = await response.json()
  return result.data
}

/**
 * Fetches a screen by ID (with all configs)
 */
export async function getScreenById(id: number): Promise<ScreenWithConfigs> {
  logger.debug(`Fetching screen: ${id}`)

  const response = await fetchFn(`${getApiUrl()}/api/screens/${id}`, {
    credentials: 'include',
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch screen')
  }

  const result = await response.json()
  return result.data
}

/**
 * Creates or updates a screen
 */
export async function upsertScreen(input: UpsertScreenInput): Promise<Screen> {
  logger.debug(`Upserting screen: ${input.name}`)

  const response = await fetchFn(`${getApiUrl()}/api/screens`, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify(input),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to save screen')
  }

  const result = await response.json()
  return result.data
}

/**
 * Clones a screen together with every setting it holds — content configs,
 * next-slide config and OBS scene overrides. The copy is created inactive.
 */
export async function duplicateScreen(id: number): Promise<Screen> {
  logger.debug(`Duplicating screen: ${id}`)

  const response = await fetchFn(`${getApiUrl()}/api/screens/${id}/duplicate`, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify({}),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to duplicate screen')
  }

  const result = await response.json()
  return result.data
}

/**
 * Deletes a screen
 */
export async function deleteScreen(id: number): Promise<void> {
  logger.debug(`Deleting screen: ${id}`)

  const response = await fetchFn(`${getApiUrl()}/api/screens/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to delete screen')
  }
}

/**
 * Updates a screen's content config for a specific content type
 */
export async function updateScreenContentConfig(
  screenId: number,
  contentType: ContentType,
  config: ContentTypeConfig,
): Promise<ContentTypeConfig> {
  logger.debug(`Updating screen content config: ${screenId} / ${contentType}`)

  const response = await fetchFn(
    `${getApiUrl()}/api/screens/${screenId}/config/${contentType}`,
    {
      method: 'PUT',
      headers: getHeaders('application/json'),
      body: JSON.stringify({ config }),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to update screen content config')
  }

  const result = await response.json()
  return result.data
}

/**
 * Updates a screen's next slide section config (for stage screens)
 */
export async function updateScreenNextSlideConfig(
  screenId: number,
  config: NextSlideSectionConfig,
): Promise<NextSlideSectionConfig> {
  logger.debug(`Updating screen next slide config: ${screenId}`)

  const response = await fetchFn(
    `${getApiUrl()}/api/screens/${screenId}/next-slide-config`,
    {
      method: 'PUT',
      headers: getHeaders('application/json'),
      body: JSON.stringify({ config }),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to update screen next slide config')
  }

  const result = await response.json()
  return result.data
}

/**
 * Updates a screen's global settings
 */
export async function updateScreenGlobalSettings(
  screenId: number,
  settings: ScreenGlobalSettings,
): Promise<Screen> {
  logger.debug(`Updating screen global settings: ${screenId}`)

  const response = await fetchFn(
    `${getApiUrl()}/api/screens/${screenId}/global-settings`,
    {
      method: 'PUT',
      headers: getHeaders('application/json'),
      body: JSON.stringify({ settings }),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to update screen global settings')
  }

  const result = await response.json()
  return result.data
}

/**
 * Batch update all screen configs in a single request
 */
export async function batchUpdateScreenConfig(
  screenId: number,
  globalSettings: ScreenGlobalSettings,
  contentConfigs: Record<ContentType, ContentTypeConfig>,
  nextSlideConfig?: NextSlideSectionConfig,
  width?: number,
  height?: number,
): Promise<ScreenWithConfigs> {
  logger.debug(`Batch updating screen config: ${screenId}`)

  const response = await fetchFn(
    `${getApiUrl()}/api/screens/${screenId}/batch-config`,
    {
      method: 'PUT',
      headers: getHeaders('application/json'),
      body: JSON.stringify({
        globalSettings,
        contentConfigs,
        nextSlideConfig,
        width,
        height,
      }),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to batch update screen config')
  }

  const result = await response.json()
  return result.data
}

/**
 * Upserts a scene override for a specific screen/scene/contentType combination
 */
export async function upsertSceneOverride(
  screenId: number,
  obsSceneName: string,
  contentType: ContentType,
  config: Record<string, unknown>,
): Promise<void> {
  logger.debug(
    `Upserting scene override: screen=${screenId}, scene=${obsSceneName}, type=${contentType}`,
  )

  const response = await fetchFn(
    `${getApiUrl()}/api/screens/${screenId}/scene-overrides/${encodeURIComponent(obsSceneName)}/${contentType}`,
    {
      method: 'PUT',
      headers: getHeaders('application/json'),
      body: JSON.stringify({ config }),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to upsert scene override')
  }
}

/**
 * Deletes a specific scene override
 */
export async function deleteSceneOverride(
  screenId: number,
  obsSceneName: string,
  contentType: ContentType,
): Promise<void> {
  logger.debug(
    `Deleting scene override: screen=${screenId}, scene=${obsSceneName}, type=${contentType}`,
  )

  const response = await fetchFn(
    `${getApiUrl()}/api/screens/${screenId}/scene-overrides/${encodeURIComponent(obsSceneName)}/${contentType}`,
    {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to delete scene override')
  }
}

/**
 * Deletes all scene overrides for a screen
 */
export async function deleteAllSceneOverrides(screenId: number): Promise<void> {
  logger.debug(`Deleting all scene overrides for screen=${screenId}`)

  const response = await fetchFn(
    `${getApiUrl()}/api/screens/${screenId}/scene-overrides`,
    {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to delete all scene overrides')
  }
}

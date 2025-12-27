import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { getApiUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import type {
  ContentType,
  ContentTypeConfig,
  NextSlideSectionConfig,
  Screen,
  ScreenGlobalSettings,
  ScreenWithConfigs,
  UpsertScreenInput,
} from '../types'

const DEBUG = import.meta.env.DEV

function log(level: 'debug' | 'info' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [screens-service] ${message}`)
}

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
  if (isMobile()) {
    const userToken = getStoredUserToken()
    if (userToken) {
      headers['Cookie'] = `user_auth=${userToken}`
    }
  }
  return headers
}

/**
 * Fetches all screens
 */
export async function getAllScreens(): Promise<Screen[]> {
  log('debug', 'Fetching all screens')

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
  log('debug', `Fetching screen: ${id}`)

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
  log('debug', `Upserting screen: ${input.name}`)

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
 * Deletes a screen
 */
export async function deleteScreen(id: number): Promise<void> {
  log('debug', `Deleting screen: ${id}`)

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
  log('debug', `Updating screen content config: ${screenId} / ${contentType}`)

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
  log('debug', `Updating screen next slide config: ${screenId}`)

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
  log('debug', `Updating screen global settings: ${screenId}`)

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
): Promise<ScreenWithConfigs> {
  log('debug', `Batch updating screen config: ${screenId}`)

  const response = await fetchFn(
    `${getApiUrl()}/api/screens/${screenId}/batch-config`,
    {
      method: 'PUT',
      headers: getHeaders('application/json'),
      body: JSON.stringify({
        globalSettings,
        contentConfigs,
        nextSlideConfig,
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

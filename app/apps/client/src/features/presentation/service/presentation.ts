import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { getApiUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import { createLogger } from '~/utils/logger'
import type {
  PresentationState,
  PresentTemporaryAnnouncementInput,
  PresentTemporaryBibleInput,
  PresentTemporaryBiblePassageInput,
  PresentTemporarySceneInput,
  PresentTemporarySongInput,
  PresentTemporaryVerseteTineriInput,
  UpdatePresentationStateInput,
} from '../types'

const logger = createLogger('app:presentation:service')

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
 * Fetches the current presentation state
 */
export async function getPresentationState(): Promise<PresentationState> {
  logger.debug('GET /api/presentation/state')
  const response = await fetchFn(`${getApiUrl()}/api/presentation/state`, {
    credentials: 'include',
    headers: getHeaders(),
  })

  if (!response.ok) {
    logger.error(`Failed to fetch presentation state: ${response.status}`)
    throw new Error('Failed to fetch presentation state')
  }

  const result = await response.json()
  logger.debug('Presentation state fetched', result.data?.updatedAt)
  return result.data
}

/**
 * Updates the presentation state
 */
export async function updatePresentationState(
  input: UpdatePresentationStateInput,
): Promise<PresentationState> {
  logger.debug('PUT /api/presentation/state', input)
  const response = await fetchFn(`${getApiUrl()}/api/presentation/state`, {
    method: 'PUT',
    headers: getHeaders('application/json'),
    body: JSON.stringify(input),
    credentials: 'include',
  })

  if (!response.ok) {
    logger.error(`Failed to update presentation state: ${response.status}`)
    throw new Error('Failed to update presentation state')
  }

  const result = await response.json()
  logger.debug('Presentation state updated', result.data?.updatedAt)
  return result.data
}

/**
 * Stops the current presentation
 */
export async function stopPresentation(): Promise<PresentationState> {
  logger.info('POST /api/presentation/stop')
  const response = await fetchFn(`${getApiUrl()}/api/presentation/stop`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
  })

  if (!response.ok) {
    logger.error(`Failed to stop presentation: ${response.status}`)
    throw new Error('Failed to stop presentation')
  }

  const result = await response.json()
  logger.debug('Presentation stopped', result.data?.updatedAt)
  return result.data
}

/**
 * Clears/hides the current slide
 */
export async function clearSlide(): Promise<PresentationState> {
  logger.info('POST /api/presentation/clear')
  const response = await fetchFn(`${getApiUrl()}/api/presentation/clear`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
  })

  if (!response.ok) {
    logger.error(`Failed to clear slide: ${response.status}`)
    throw new Error('Failed to clear slide')
  }

  const result = await response.json()
  logger.debug('Slide cleared', result.data?.updatedAt)
  return result.data
}

/**
 * Shows the last displayed slide
 */
export async function showSlide(): Promise<PresentationState> {
  logger.info('POST /api/presentation/show')
  const response = await fetchFn(`${getApiUrl()}/api/presentation/show`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
  })

  if (!response.ok) {
    logger.error(`Failed to show slide: ${response.status}`)
    throw new Error('Failed to show slide')
  }

  const result = await response.json()
  logger.debug('Slide shown', result.data?.updatedAt)
  return result.data
}

/**
 * Navigates to next/previous queue item
 */
export async function navigateQueueSlide(
  direction: 'next' | 'prev',
): Promise<PresentationState> {
  logger.info(`POST /api/presentation/navigate-queue direction=${direction}`)
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/navigate-queue`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify({ direction }),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    logger.error(`Failed to navigate queue: ${response.status}`)
    throw new Error('Failed to navigate queue')
  }

  const result = await response.json()
  logger.debug('Queue navigated', result.data?.updatedAt)
  return result.data
}

// ============================================================================
// TEMPORARY CONTENT FUNCTIONS (bypasses queue for instant display)
// ============================================================================

/**
 * Present a Bible verse temporarily (bypasses queue)
 */
export async function presentTemporaryBible(
  input: PresentTemporaryBibleInput,
): Promise<PresentationState> {
  logger.info('POST /api/presentation/temporary-bible', input.reference)
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/temporary-bible`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(input),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    logger.error(`Failed to present temporary Bible: ${response.status}`)
    throw new Error('Failed to present temporary Bible verse')
  }

  const result = await response.json()
  logger.debug('Temporary Bible presented', result.data?.updatedAt)
  return result.data
}

/**
 * Present a song temporarily (bypasses queue)
 */
export async function presentTemporarySong(
  input: PresentTemporarySongInput,
): Promise<PresentationState> {
  logger.info('POST /api/presentation/temporary-song', input.songId)
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/temporary-song`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(input),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    logger.error(`Failed to present temporary song: ${response.status}`)
    throw new Error('Failed to present temporary song')
  }

  const result = await response.json()
  logger.debug('Temporary song presented', result.data?.updatedAt)
  return result.data
}

/**
 * Navigate within temporary content (next/prev)
 * Includes timestamp to prevent race conditions when navigating rapidly
 */
export async function navigateTemporary(input: {
  direction: 'next' | 'prev'
  requestTimestamp: number
}): Promise<PresentationState> {
  logger.info(
    `POST /api/presentation/navigate-temporary direction=${input.direction} ts=${input.requestTimestamp}`,
  )
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/navigate-temporary`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify({
        direction: input.direction,
        requestTimestamp: input.requestTimestamp,
      }),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    logger.error(`Failed to navigate temporary: ${response.status}`)
    throw new Error('Failed to navigate temporary content')
  }

  const result = await response.json()
  logger.debug('Temporary content navigated', result.data?.updatedAt)
  return result.data
}

/**
 * Clear temporary content
 */
export async function clearTemporaryContent(): Promise<PresentationState> {
  logger.info('POST /api/presentation/clear-temporary')
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/clear-temporary`,
    {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    logger.error(`Failed to clear temporary content: ${response.status}`)
    throw new Error('Failed to clear temporary content')
  }

  const result = await response.json()
  logger.debug('Temporary content cleared', result.data?.updatedAt)
  return result.data
}

/**
 * Present an announcement temporarily (bypasses queue)
 */
export async function presentTemporaryAnnouncement(
  input: PresentTemporaryAnnouncementInput,
): Promise<PresentationState> {
  logger.info('POST /api/presentation/temporary-announcement')
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/temporary-announcement`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(input),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    logger.error(`Failed to present temporary announcement: ${response.status}`)
    throw new Error('Failed to present temporary announcement')
  }

  const result = await response.json()
  logger.debug('Temporary announcement presented', result.data?.updatedAt)
  return result.data
}

/**
 * Present a Bible passage temporarily (bypasses queue)
 */
export async function presentTemporaryBiblePassage(
  input: PresentTemporaryBiblePassageInput,
): Promise<PresentationState> {
  logger.info('POST /api/presentation/temporary-bible-passage')
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/temporary-bible-passage`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(input),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    logger.error(
      `Failed to present temporary Bible passage: ${response.status}`,
    )
    throw new Error('Failed to present temporary Bible passage')
  }

  const result = await response.json()
  logger.debug('Temporary Bible passage presented', result.data?.updatedAt)
  return result.data
}

/**
 * Present versete tineri temporarily (bypasses queue)
 */
export async function presentTemporaryVerseteTineri(
  input: PresentTemporaryVerseteTineriInput,
): Promise<PresentationState> {
  logger.info('POST /api/presentation/temporary-versete-tineri')
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/temporary-versete-tineri`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(input),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    logger.error(
      `Failed to present temporary versete tineri: ${response.status}`,
    )
    throw new Error('Failed to present temporary versete tineri')
  }

  const result = await response.json()
  logger.debug('Temporary versete tineri presented', result.data?.updatedAt)
  return result.data
}

/**
 * Present a scene temporarily (shows empty slide, used for OBS scene switching)
 */
export async function presentTemporaryScene(
  input: PresentTemporarySceneInput,
): Promise<PresentationState> {
  logger.info('POST /api/presentation/temporary-scene', input.sceneId)
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/temporary-scene`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(input),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    logger.error(`Failed to present temporary scene: ${response.status}`)
    throw new Error('Failed to present temporary scene')
  }

  const result = await response.json()
  logger.debug('Temporary scene presented', result.data?.updatedAt)
  return result.data
}

import type {
  AddToQueueInput,
  ApiResponse,
  OperationResult,
  PresentationSession,
  PresentationTheme,
  QueueState,
} from './types'
import { fetcher } from '../../../utils/fetcher'

const QUEUE_API = '/api/presentation/queue'

/**
 * Get queue state
 */
export async function getQueueState(): Promise<QueueState> {
  try {
    const response = await fetcher<ApiResponse<QueueState>>(QUEUE_API)
    if (response.error) {
      return { queue: [], activePosition: -1 }
    }
    return response.data ?? { queue: [], activePosition: -1 }
  } catch (_error) {
    return { queue: [], activePosition: -1 }
  }
}

/**
 * Add item to queue
 */
export async function addToQueue(
  input: AddToQueueInput,
): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(QUEUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Add to queue and present immediately
 */
export async function addToQueueAndPresent(
  input: AddToQueueInput,
): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(
      `${QUEUE_API}/present`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Remove item from queue
 */
export async function removeFromQueue(
  queueItemId: number,
): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(
      `${QUEUE_API}/${queueItemId}`,
      {
        method: 'DELETE',
      },
    )
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Move to next queue item
 */
export async function nextQueueItem(): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(
      `${QUEUE_API}/next`,
      {
        method: 'POST',
      },
    )
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Clear all items from queue
 */
export async function clearQueue(): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(QUEUE_API, {
      method: 'DELETE',
    })
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Get active presentation session
 */
export async function getActiveSession(): Promise<PresentationSession | null> {
  try {
    const response = await fetcher<ApiResponse<PresentationSession | null>>(
      '/api/presentation/session',
    )
    if (response.error) {
      return null
    }
    return response.data ?? null
  } catch (_error) {
    return null
  }
}

/**
 * Update session slide
 */
export async function setCurrentSlide(
  sessionId: number,
  slideIndex: number,
): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(
      `/api/presentation/session/${sessionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_slide: slideIndex }),
      },
    )
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Get all themes
 */
export async function getAllThemes(): Promise<PresentationTheme[]> {
  try {
    const response =
      await fetcher<ApiResponse<PresentationTheme[]>>('/api/themes')
    if (response.error) {
      return []
    }
    return response.data ?? []
  } catch (_error) {
    return []
  }
}

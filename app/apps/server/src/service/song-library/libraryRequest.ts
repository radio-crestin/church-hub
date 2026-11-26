import { getLibraryServiceUrl } from './getLibraryServiceUrl'
import { CURATED_SOURCE_ID } from './types'
import {
  serviceError,
  syncServiceRequest,
} from '../sync/cloud/syncServiceRequest'

/**
 * Calls the curated library's routes on the sync service
 * (/sync/libraries/church-hub…), as the signed-in curator when `ticket` is
 * given. Throws the service's refusal (`Sync service <status> <code>: …`).
 */
export async function libraryRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  options: { body?: unknown; ticket?: string } = {},
): Promise<T> {
  const response = await syncServiceRequest<T>(
    { serviceUrl: await getLibraryServiceUrl(), ownerTicket: options.ticket },
    method,
    `/libraries/${CURATED_SOURCE_ID}${path}`,
    options.body,
  )
  if (response.status >= 400) throw serviceError(response)
  return response.body
}

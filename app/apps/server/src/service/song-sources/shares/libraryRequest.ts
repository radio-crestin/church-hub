import type { CloudIdentity } from '../../sync/cloud/cloudIdentityStore'
import {
  type SyncServiceResponse,
  serviceError,
  syncServiceRequest,
} from '../../sync/cloud/syncServiceRequest'

/**
 * A call to the sync service's shared library routes
 * (/sync/libraries/<sourceId>…), signed with the church's server token.
 * Throws on a refusal, except the statuses the caller handles (`allow`).
 */
export async function libraryRequest<T>(
  identity: CloudIdentity,
  method: 'GET' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  allow: number[] = [],
): Promise<SyncServiceResponse<T>> {
  const response = await syncServiceRequest<T>(
    { serviceUrl: identity.serviceUrl, identity, atRoot: true },
    method,
    `/libraries/${path}`,
    body,
  )
  if (response.status >= 300 && !allow.includes(response.status)) {
    throw serviceError(response)
  }
  return response
}

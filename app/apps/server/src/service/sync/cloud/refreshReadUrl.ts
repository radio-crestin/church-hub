import { type CloudIdentity, updateCloudIdentity } from './cloudIdentityStore'
import { serviceError, syncServiceRequest } from './syncServiceRequest'

/**
 * Asks the service where the church is read from now (its path secret
 * rotated after a device was revoked) and keeps it. Returns the new URL.
 */
export async function refreshReadUrl(identity: CloudIdentity): Promise<string> {
  const response = await syncServiceRequest<{ readUrl: string }>(
    { serviceUrl: identity.serviceUrl, identity },
    'GET',
    '/path',
  )
  if (response.status !== 200) throw serviceError(response)
  await updateCloudIdentity({ readUrl: response.body.readUrl, headEtag: null })
  return response.body.readUrl
}

import { getCloudIdentity, updateCloudIdentity } from './cloudIdentityStore'
import { serviceError, syncServiceRequest } from './syncServiceRequest'

/**
 * Makes this PC's guest church owned by the signed-in Google account: the
 * service records the owner, nothing moves. Kept locally too, so a local
 * backup carries who owns the church.
 */
export async function claimCloudChurch(
  ownerTicket: string,
): Promise<{ ownerEmail: string }> {
  const identity = await getCloudIdentity()
  if (!identity) throw new Error('not_connected')
  const response = await syncServiceRequest<{ email: string }>(
    { serviceUrl: identity.serviceUrl, identity },
    'POST',
    '/owner',
    { ownerTicket },
  )
  if (response.status !== 200) throw serviceError(response)
  await updateCloudIdentity({ ownerEmail: response.body.email })
  return { ownerEmail: response.body.email }
}

import { type CloudIdentity, updateCloudIdentity } from './cloudIdentityStore'
import { serviceError, syncServiceRequest } from './syncServiceRequest'

/**
 * Asks the service where the church is read from now (its path secret
 * rotated after a device was revoked) and who owns it, and keeps both.
 * Returns the read URL. It is also the PC's check-in: a second PC holding
 * the same token is told so here (server_in_use).
 */
export async function refreshReadUrl(identity: CloudIdentity): Promise<string> {
  const response = await syncServiceRequest<{
    readUrl: string
    ownerEmail?: string | null
  }>({ serviceUrl: identity.serviceUrl, identity }, 'GET', '/path')
  if (response.status !== 200) throw serviceError(response)
  const { readUrl, ownerEmail = null } = response.body
  if (readUrl !== identity.readUrl || ownerEmail !== identity.ownerEmail) {
    await updateCloudIdentity({
      readUrl,
      ownerEmail,
      ...(readUrl !== identity.readUrl && { headEtag: null }),
    })
    identity.ownerEmail = ownerEmail
    if (readUrl !== identity.readUrl) identity.headEtag = null
    identity.readUrl = readUrl
  }
  return readUrl
}

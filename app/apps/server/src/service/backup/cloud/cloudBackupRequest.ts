import { CloudBackupError } from './CloudBackupError'
import { cloudBackupFetch } from './cloudBackupFetch'
import { getCloudAccess } from './cloudBackupSession'

/**
 * A signed-in call to the backup service. A 401 (the access token was
 * revoked or expired early) refreshes the session once and retries.
 */
export async function cloudBackupRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const { serviceUrl, token } = await getCloudAccess()
  try {
    return await cloudBackupFetch<T>(serviceUrl, method, path, { token, body })
  } catch (error) {
    if (!(error instanceof CloudBackupError) || error.status !== 401)
      throw error
    const fresh = await getCloudAccess(true)
    return cloudBackupFetch<T>(fresh.serviceUrl, method, path, {
      token: fresh.token,
      body,
    })
  }
}

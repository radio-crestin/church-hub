import {
  type CloudIdentity,
  getCloudIdentity,
} from '../../sync/cloud/cloudIdentityStore'

/** Sharing goes through the cloud sync service: it must be on. */
export async function requireCloudIdentity(): Promise<CloudIdentity> {
  const identity = await getCloudIdentity()
  if (!identity) throw new Error('cloud_sync_off')
  return identity
}

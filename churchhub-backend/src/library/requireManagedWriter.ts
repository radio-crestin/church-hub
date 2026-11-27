import type { Context } from 'hono'
import type { SyncStore } from '../sync/state/ChurchState'
import type { Bindings } from '../types'
import { constantTimeEqual } from '../utils/constantTimeEqual'
import { requireCurator } from './requireCurator'

/**
 * Who may write the libraries Church Hub manages (the curated one,
 * Resurse Creștine…) and the featured list: a signed-in curator, or the
 * build that publishes them (LIBRARY_PUBLISH_TOKEN, a bearer token).
 */
export async function requireManagedWriter(
  c: Context<{ Bindings: Bindings }>,
  store: SyncStore
): Promise<void> {
  const token = c.req.header('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  const publishToken = c.env.LIBRARY_PUBLISH_TOKEN
  if (token && publishToken && constantTimeEqual(token, publishToken)) return
  await requireCurator(c, store)
}

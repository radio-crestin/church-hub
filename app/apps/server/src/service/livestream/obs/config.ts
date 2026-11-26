import { eq } from 'drizzle-orm'

import { getDatabase } from '../../../db'
import { obsConfig } from '../../../db/schema'
import {
  openSecret,
  requireSameDestination,
  sealSecret,
  secretPlaces,
} from '../../secret-store'
import type { OBSConfig } from '../types'

type OBSConfigRow = typeof obsConfig.$inferSelect

function toOBSConfig(row: OBSConfigRow): OBSConfig {
  return {
    id: row.id,
    host: row.host,
    port: row.port,
    // Shown on the OBS page to type into OBS; sealed only at rest.
    password: openSecret(row.password, secretPlaces.obsPassword) ?? '',
    autoConnect: row.autoConnect,
  }
}

export async function getOBSConfig(): Promise<OBSConfig> {
  const db = getDatabase()
  const [existing] = await db.select().from(obsConfig).limit(1)
  if (existing) return toOBSConfig(existing)

  const [created] = await db
    .insert(obsConfig)
    .values({
      host: '127.0.0.1',
      port: 4455,
      password: '',
      autoConnect: false,
    })
    .returning()
  if (!created) throw new Error('Failed to create the OBS config row')
  return toOBSConfig(created)
}

export async function updateOBSConfig(
  data: Partial<Omit<OBSConfig, 'id'>>,
): Promise<OBSConfig> {
  const db = getDatabase()
  const current = await getOBSConfig()
  // The saved password is kept only for the address it was saved for.
  if (data.password === undefined && current.password !== '') {
    requireSameDestination(
      { ...current },
      { ...current, ...data },
      secretPlaces.obsPassword.destination,
    )
  }

  const [updated] = await db
    .update(obsConfig)
    .set({
      ...(data.host !== undefined && { host: data.host }),
      ...(data.port !== undefined && { port: data.port }),
      ...(data.password !== undefined && {
        password: sealSecret(data.password, secretPlaces.obsPassword),
      }),
      ...(data.autoConnect !== undefined && { autoConnect: data.autoConnect }),
      updatedAt: new Date(),
    })
    .where(eq(obsConfig.id, current.id!))
    .returning()
  if (!updated) throw new Error(`OBS config ${current.id} not found`)
  return toOBSConfig(updated)
}

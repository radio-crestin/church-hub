import { eq } from 'drizzle-orm'

import { getDatabase } from '../../../db'
import { obsConfig } from '../../../db/schema'
import type { OBSConfig } from '../types'

export async function getOBSConfig(): Promise<OBSConfig> {
  const db = getDatabase()
  const configs = await db.select().from(obsConfig).limit(1)

  if (configs.length === 0) {
    const [newConfig] = await db
      .insert(obsConfig)
      .values({
        host: '127.0.0.1',
        port: 4455,
        password: '',
        autoConnect: false,
      })
      .returning()

    return {
      id: newConfig.id,
      host: newConfig.host,
      port: newConfig.port,
      password: newConfig.password,
      autoConnect: newConfig.autoConnect,
    }
  }

  const config = configs[0]
  return {
    id: config.id,
    host: config.host,
    port: config.port,
    password: config.password,
    autoConnect: config.autoConnect,
  }
}

export async function updateOBSConfig(
  data: Partial<Omit<OBSConfig, 'id'>>,
): Promise<OBSConfig> {
  const db = getDatabase()
  const current = await getOBSConfig()

  const [updated] = await db
    .update(obsConfig)
    .set({
      ...(data.host !== undefined && { host: data.host }),
      ...(data.port !== undefined && { port: data.port }),
      ...(data.password !== undefined && { password: data.password }),
      ...(data.autoConnect !== undefined && { autoConnect: data.autoConnect }),
      updatedAt: new Date(),
    })
    .where(eq(obsConfig.id, current.id!))
    .returning()

  return {
    id: updated.id,
    host: updated.host,
    port: updated.port,
    password: updated.password,
    autoConnect: updated.autoConnect,
  }
}

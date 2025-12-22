import { eq } from 'drizzle-orm'

import { getDatabase } from '../../../db'
import { mixerConfig } from '../../../db/schema'
import type { MixerConfig } from '../types'

export async function getMixerConfig(): Promise<MixerConfig> {
  const db = getDatabase()
  const configs = await db.select().from(mixerConfig).limit(1)

  if (configs.length === 0) {
    const [newConfig] = await db
      .insert(mixerConfig)
      .values({
        host: '192.168.0.50',
        port: 10024,
        isEnabled: false,
        channelCount: 16,
      })
      .returning()

    return {
      id: newConfig.id,
      host: newConfig.host,
      port: newConfig.port,
      isEnabled: newConfig.isEnabled,
      channelCount: newConfig.channelCount,
    }
  }

  const config = configs[0]
  return {
    id: config.id,
    host: config.host,
    port: config.port,
    isEnabled: config.isEnabled,
    channelCount: config.channelCount,
  }
}

export async function updateMixerConfig(
  data: Partial<Omit<MixerConfig, 'id'>>,
): Promise<MixerConfig> {
  const db = getDatabase()
  const current = await getMixerConfig()

  const [updated] = await db
    .update(mixerConfig)
    .set({
      ...(data.host !== undefined && { host: data.host }),
      ...(data.port !== undefined && { port: data.port }),
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      ...(data.channelCount !== undefined && {
        channelCount: data.channelCount,
      }),
      updatedAt: new Date(),
    })
    .where(eq(mixerConfig.id, current.id!))
    .returning()

  return {
    id: updated.id,
    host: updated.host,
    port: updated.port,
    isEnabled: updated.isEnabled,
    channelCount: updated.channelCount,
  }
}

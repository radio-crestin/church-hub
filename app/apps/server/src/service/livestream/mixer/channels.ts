import { eq } from 'drizzle-orm'

import { getDatabase } from '../../../db'
import { mixerChannels } from '../../../db/schema'
import type { MixerChannel } from '../types'

export async function getMixerChannels(): Promise<MixerChannel[]> {
  const db = getDatabase()
  const channels = await db
    .select()
    .from(mixerChannels)
    .orderBy(mixerChannels.channelNumber)

  return channels.map((ch) => ({
    id: ch.id,
    channelNumber: ch.channelNumber,
    label: ch.label,
  }))
}

export async function updateMixerChannel(
  channelNumber: number,
  label: string,
): Promise<MixerChannel> {
  const db = getDatabase()

  const existing = await db
    .select()
    .from(mixerChannels)
    .where(eq(mixerChannels.channelNumber, channelNumber))
    .limit(1)

  if (existing.length > 0) {
    const [updated] = await db
      .update(mixerChannels)
      .set({ label, updatedAt: new Date() })
      .where(eq(mixerChannels.channelNumber, channelNumber))
      .returning()

    return {
      id: updated.id,
      channelNumber: updated.channelNumber,
      label: updated.label,
    }
  }

  const [created] = await db
    .insert(mixerChannels)
    .values({ channelNumber, label })
    .returning()

  return {
    id: created.id,
    channelNumber: created.channelNumber,
    label: created.label,
  }
}

export async function updateMixerChannels(
  channels: { channelNumber: number; label: string }[],
): Promise<MixerChannel[]> {
  const results: MixerChannel[] = []

  for (const channel of channels) {
    const result = await updateMixerChannel(
      channel.channelNumber,
      channel.label,
    )
    results.push(result)
  }

  return results.sort((a, b) => a.channelNumber - b.channelNumber)
}

export async function deleteMixerChannel(channelNumber: number): Promise<void> {
  const db = getDatabase()
  await db
    .delete(mixerChannels)
    .where(eq(mixerChannels.channelNumber, channelNumber))
}

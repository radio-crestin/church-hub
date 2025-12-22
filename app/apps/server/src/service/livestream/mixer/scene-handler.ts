import { eq } from 'drizzle-orm'

import { getMixerConfig } from './config'
import {
  ensureMixerClient,
  sendMuteCommand,
  sendUnmuteCommand,
} from './osc-client'
import { getDatabase } from '../../../db'
import { obsScenes } from '../../../db/schema'
import type { MixerChannelActions } from '../types'

export async function handleSceneMixerActions(
  sceneName: string,
): Promise<void> {
  const config = await getMixerConfig()

  if (!config.isEnabled) {
    return
  }

  await ensureMixerClient()

  const db = getDatabase()
  const scenes = await db
    .select()
    .from(obsScenes)
    .where(eq(obsScenes.obsSceneName, sceneName))
    .limit(1)

  if (scenes.length === 0) {
    return
  }

  const scene = scenes[0]
  let actions: MixerChannelActions

  try {
    actions = JSON.parse(scene.mixerChannelActions) as MixerChannelActions
  } catch {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error(
      `[mixer] Failed to parse mixer actions for scene: ${sceneName}`,
    )
    return
  }

  if (!actions.mute?.length && !actions.unmute?.length) {
    return
  }

  // biome-ignore lint/suspicious/noConsole: Info logging
  console.log(
    `[mixer] Applying mixer actions for scene "${sceneName}": unmute=[${actions.unmute?.join(',')}], mute=[${actions.mute?.join(',')}]`,
  )

  // Send unmute commands first, then mute commands
  for (const channel of actions.unmute || []) {
    const channelNum = Number.parseInt(channel, 10)
    if (!Number.isNaN(channelNum)) {
      sendUnmuteCommand(channelNum)
    }
  }

  for (const channel of actions.mute || []) {
    const channelNum = Number.parseInt(channel, 10)
    if (!Number.isNaN(channelNum)) {
      sendMuteCommand(channelNum)
    }
  }
}

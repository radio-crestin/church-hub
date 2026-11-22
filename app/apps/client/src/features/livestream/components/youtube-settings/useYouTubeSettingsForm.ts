import { useCallback, useEffect, useState } from 'react'

import { useYouTubeConfig } from '../../hooks'
import { getBroadcastTemplate, type YouTubeConfigUpdate } from '../../service'
import type { YouTubeConfig } from '../../types'

/** The broadcast settings the YouTube settings page edits. */
export type YouTubeSettingsDraft = Omit<
  YouTubeConfig,
  'id' | 'startSceneName' | 'stopSceneName' | 'broadcastMode'
>

export type SetSetting = <K extends keyof YouTubeSettingsDraft>(
  key: K,
  value: YouTubeSettingsDraft[K],
) => void

function toDraft(config: YouTubeConfig): YouTubeSettingsDraft {
  const { id, startSceneName, stopSceneName, broadcastMode, ...draft } = config
  return draft
}

/** Sends a cleared optional setting as `null`, which JSON keeps. */
function toUpdate(draft: YouTubeSettingsDraft): YouTubeConfigUpdate {
  return {
    ...draft,
    selectedBroadcastId: draft.selectedBroadcastId ?? null,
    streamKeyId: draft.streamKeyId ?? null,
    playlistId: draft.playlistId ?? null,
    categoryId: draft.categoryId ?? null,
    thumbnailUrl: draft.thumbnailUrl ?? null,
  }
}

/**
 * The YouTube settings being edited: the saved ones until changed, a past
 * broadcast's when one is picked as the template, saved together.
 */
export function useYouTubeSettingsForm() {
  const { config, updateAsync, isUpdating } = useYouTubeConfig()
  const [draft, setDraft] = useState<YouTubeSettingsDraft>()
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false)

  useEffect(() => {
    if (config && !draft) setDraft(toDraft(config))
  }, [config, draft])

  const set: SetSetting = (key, value) =>
    setDraft((current) => current && { ...current, [key]: value })

  const applyTemplate = useCallback(async (broadcastId: string) => {
    setIsApplyingTemplate(true)
    try {
      const template = await getBroadcastTemplate(broadcastId)
      setDraft((current) => current && { ...current, ...template })
    } finally {
      setIsApplyingTemplate(false)
    }
  }, [])

  const save = async () => {
    if (!draft) return
    const saved = await updateAsync(toUpdate(draft))
    setDraft(toDraft(saved))
  }

  const isDirty =
    !!config &&
    !!draft &&
    JSON.stringify(toDraft(config)) !== JSON.stringify(draft)

  return {
    config,
    draft,
    set,
    applyTemplate,
    isApplyingTemplate,
    save,
    isSaving: isUpdating,
    isDirty,
  }
}

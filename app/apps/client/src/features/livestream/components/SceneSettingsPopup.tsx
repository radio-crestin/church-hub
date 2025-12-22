import {
  Eye,
  EyeOff,
  Play,
  Plus,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ShortcutRecorder } from '~/features/keyboard-shortcuts'
import { CONTENT_TYPES, type ContentType } from '../constants/content-types'
import { useMixerChannels, useMixerConfig } from '../hooks'
import type { MixerChannelActions, OBSScene, YouTubeConfig } from '../types'
import { validateShortcut } from '../utils/shortcutValidation'

interface SceneSettingsPopupProps {
  scene: OBSScene
  allScenes: OBSScene[]
  youtubeConfig?: YouTubeConfig
  onUpdateYouTubeConfig?: (config: Partial<YouTubeConfig>) => void
  onClose: () => void
  onSave: (data: {
    displayName: string
    isVisible: boolean
    shortcuts: string[]
    contentTypes: ContentType[]
    mixerChannelActions: MixerChannelActions
  }) => void
}

export function SceneSettingsPopup({
  scene,
  allScenes,
  youtubeConfig,
  onUpdateYouTubeConfig,
  onClose,
  onSave,
}: SceneSettingsPopupProps) {
  const { t } = useTranslation('livestream')
  const { config: mixerConfig } = useMixerConfig()
  const { channels: savedMixerChannels } = useMixerChannels()

  // Generate all channels based on channelCount, using saved labels or defaults
  const mixerChannels = Array.from(
    { length: mixerConfig?.channelCount ?? 0 },
    (_, i) => {
      const channelNumber = i + 1
      const savedChannel = savedMixerChannels.find(
        (ch) => ch.channelNumber === channelNumber,
      )
      return {
        channelNumber,
        label: savedChannel?.label || '',
      }
    },
  )
  const [displayName, setDisplayName] = useState(scene.displayName)
  const [isVisible, setIsVisible] = useState(scene.isVisible)
  const [shortcuts, setShortcuts] = useState<string[]>(scene.shortcuts || [])
  const [contentTypes, setContentTypes] = useState<ContentType[]>(
    scene.contentTypes || [],
  )
  const [mixerMute, setMixerMute] = useState<string[]>(
    scene.mixerChannelActions?.mute || [],
  )
  const [mixerUnmute, setMixerUnmute] = useState<string[]>(
    scene.mixerChannelActions?.unmute || [],
  )
  const [errors, setErrors] = useState<Record<number, string>>({})

  const handleAddShortcut = useCallback(() => {
    setShortcuts((prev) => [...prev, ''])
  }, [])

  const handleRemoveShortcut = useCallback((index: number) => {
    setShortcuts((prev) => prev.filter((_, i) => i !== index))
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[index]
      return newErrors
    })
  }, [])

  const handleUpdateShortcut = useCallback(
    (index: number, value: string) => {
      const newShortcuts = [...shortcuts]
      newShortcuts[index] = value
      setShortcuts(newShortcuts)

      const conflict = validateShortcut(value, scene.id, allScenes)
      if (conflict) {
        setErrors((prev) => ({
          ...prev,
          [index]: t('scenes.shortcutConflict', {
            scene: conflict.conflictingSceneName,
          }),
        }))
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[index]
          return newErrors
        })
      }
    },
    [shortcuts, scene.id, allScenes, t],
  )

  const handleSave = useCallback(() => {
    const validShortcuts = shortcuts.filter((s) => s.length > 0)

    let hasConflicts = false
    for (const shortcut of validShortcuts) {
      const conflict = validateShortcut(shortcut, scene.id, allScenes)
      if (conflict) {
        hasConflicts = true
        break
      }
    }

    if (hasConflicts) return

    onSave({
      displayName: displayName.trim() || scene.obsSceneName,
      isVisible,
      shortcuts: validShortcuts,
      contentTypes,
      mixerChannelActions: {
        mute: mixerMute,
        unmute: mixerUnmute,
      },
    })
  }, [
    displayName,
    isVisible,
    shortcuts,
    contentTypes,
    mixerMute,
    mixerUnmute,
    scene,
    allScenes,
    onSave,
  ])

  const isStartScene = youtubeConfig?.startSceneName === scene.obsSceneName
  const isStopScene = youtubeConfig?.stopSceneName === scene.obsSceneName

  const handleToggleStartScene = useCallback(() => {
    if (!onUpdateYouTubeConfig) return
    if (isStartScene) {
      // Unselect start scene
      onUpdateYouTubeConfig({ startSceneName: null })
    } else {
      // Select as start scene and clear stop scene if this scene was stop
      onUpdateYouTubeConfig({
        startSceneName: scene.obsSceneName,
        ...(isStopScene && { stopSceneName: null }),
      })
    }
  }, [isStartScene, isStopScene, scene.obsSceneName, onUpdateYouTubeConfig])

  const handleToggleStopScene = useCallback(() => {
    if (!onUpdateYouTubeConfig) return
    if (isStopScene) {
      // Unselect stop scene
      onUpdateYouTubeConfig({ stopSceneName: null })
    } else {
      // Select as stop scene and clear start scene if this scene was start
      onUpdateYouTubeConfig({
        stopSceneName: scene.obsSceneName,
        ...(isStartScene && { startSceneName: null }),
      })
    }
  }, [isStartScene, isStopScene, scene.obsSceneName, onUpdateYouTubeConfig])

  const handleToggleContentType = useCallback((type: ContentType) => {
    setContentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }, [])

  const handleToggleMixerMute = useCallback((channelNum: string) => {
    setMixerMute((prev) => {
      if (prev.includes(channelNum)) {
        return prev.filter((c) => c !== channelNum)
      }
      return [...prev, channelNum]
    })
    // Remove from unmute if adding to mute
    setMixerUnmute((prev) => prev.filter((c) => c !== channelNum))
  }, [])

  const handleToggleMixerUnmute = useCallback((channelNum: string) => {
    setMixerUnmute((prev) => {
      if (prev.includes(channelNum)) {
        return prev.filter((c) => c !== channelNum)
      }
      return [...prev, channelNum]
    })
    // Remove from mute if adding to unmute
    setMixerMute((prev) => prev.filter((c) => c !== channelNum))
  }, [])

  const hasErrors = Object.keys(errors).length > 0

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('scenes.sceneSettings', { defaultValue: 'Scene Settings' })}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('scenes.displayName')}
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={scene.obsSceneName}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {scene.displayName !== scene.obsSceneName && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                OBS: {scene.obsSceneName}
              </p>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setIsVisible(!isVisible)}
              className={`
                flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors
                ${
                  isVisible
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }
              `}
            >
              {isVisible ? <Eye size={20} /> : <EyeOff size={20} />}
              <span className="text-sm font-medium">
                {isVisible ? t('scenes.visible') : t('scenes.hidden')}
              </span>
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('scenes.shortcuts')}
              </label>
            </div>

            {shortcuts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {t('scenes.noShortcuts')}
              </p>
            ) : (
              <div className="space-y-2 mb-2">
                {shortcuts.map((shortcut, index) => (
                  <div key={index}>
                    <ShortcutRecorder
                      value={shortcut}
                      onChange={(value) => handleUpdateShortcut(index, value)}
                      onRemove={() => handleRemoveShortcut(index)}
                      error={errors[index]}
                      namespace="livestream"
                    />
                    {errors[index] && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors[index]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddShortcut}
              className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              <Plus size={16} />
              {t('scenes.addShortcut')}
            </button>
          </div>

          {youtubeConfig && onUpdateYouTubeConfig && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {t('scenes.streamSceneSettings')}
              </h4>

              <button
                type="button"
                onClick={handleToggleStartScene}
                className={`
                  flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors mb-2
                  ${
                    isStartScene
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <Play size={20} />
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium block">
                    {t('scenes.useAsStartScene')}
                  </span>
                  <span className="text-xs opacity-75">
                    {t('scenes.useAsStartSceneDescription')}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={handleToggleStopScene}
                className={`
                  flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors
                  ${
                    isStopScene
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <Square size={20} />
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium block">
                    {t('scenes.useAsStopScene')}
                  </span>
                  <span className="text-xs opacity-75">
                    {t('scenes.useAsStopSceneDescription')}
                  </span>
                </div>
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('scenes.autoSceneSettings')}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {t('scenes.autoSceneDescription')}
            </p>
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
              {contentTypes.map((value) => {
                const contentType = CONTENT_TYPES.find(
                  (ct) => ct.value === value,
                )
                return (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full"
                  >
                    {contentType ? t(contentType.labelKey) : value}
                    <button
                      type="button"
                      onClick={() => handleToggleContentType(value)}
                      className="hover:text-indigo-900 dark:hover:text-indigo-200"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )
              })}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleToggleContentType(e.target.value as ContentType)
                  }
                }}
                className="flex-1 min-w-[100px] text-sm bg-transparent border-none outline-none text-gray-500 dark:text-gray-400 cursor-pointer"
              >
                <option value="">
                  {contentTypes.length === 0
                    ? t('scenes.selectContentTypes')
                    : t('scenes.addMore')}
                </option>
                {CONTENT_TYPES.filter(
                  (ct) => !contentTypes.includes(ct.value),
                ).map(({ value, labelKey }) => (
                  <option key={value} value={value}>
                    {t(labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {mixerChannels.length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('scenes.mixerActions')}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {t('scenes.mixerActionsDescription')}
              </p>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2
                      size={16}
                      className="text-green-600 dark:text-green-400"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('scenes.unmute')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                    {mixerUnmute.map((channelStr) => {
                      const channel = mixerChannels.find(
                        (ch) =>
                          ch.channelNumber.toString().padStart(2, '0') ===
                          channelStr,
                      )
                      return (
                        <span
                          key={channelStr}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full"
                        >
                          {channel?.label || `CH${channelStr}`}
                          <button
                            type="button"
                            onClick={() => handleToggleMixerUnmute(channelStr)}
                            className="hover:text-green-900 dark:hover:text-green-200"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      )
                    })}
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleToggleMixerUnmute(e.target.value)
                        }
                      }}
                      className="flex-1 min-w-[100px] text-sm bg-transparent border-none outline-none text-gray-500 dark:text-gray-400 cursor-pointer"
                    >
                      <option value="">
                        {mixerUnmute.length === 0
                          ? t('scenes.selectChannels')
                          : t('scenes.addMore')}
                      </option>
                      {mixerChannels
                        .filter(
                          (ch) =>
                            !mixerUnmute.includes(
                              ch.channelNumber.toString().padStart(2, '0'),
                            ),
                        )
                        .map((channel) => {
                          const channelStr = channel.channelNumber
                            .toString()
                            .padStart(2, '0')
                          return (
                            <option key={channelStr} value={channelStr}>
                              {channel.label || `CH${channelStr}`}
                            </option>
                          )
                        })}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <VolumeX
                      size={16}
                      className="text-red-600 dark:text-red-400"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('scenes.mute')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                    {mixerMute.map((channelStr) => {
                      const channel = mixerChannels.find(
                        (ch) =>
                          ch.channelNumber.toString().padStart(2, '0') ===
                          channelStr,
                      )
                      return (
                        <span
                          key={channelStr}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full"
                        >
                          {channel?.label || `CH${channelStr}`}
                          <button
                            type="button"
                            onClick={() => handleToggleMixerMute(channelStr)}
                            className="hover:text-red-900 dark:hover:text-red-200"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      )
                    })}
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleToggleMixerMute(e.target.value)
                        }
                      }}
                      className="flex-1 min-w-[100px] text-sm bg-transparent border-none outline-none text-gray-500 dark:text-gray-400 cursor-pointer"
                    >
                      <option value="">
                        {mixerMute.length === 0
                          ? t('scenes.selectChannels')
                          : t('scenes.addMore')}
                      </option>
                      {mixerChannels
                        .filter(
                          (ch) =>
                            !mixerMute.includes(
                              ch.channelNumber.toString().padStart(2, '0'),
                            ),
                        )
                        .map((channel) => {
                          const channelStr = channel.channelNumber
                            .toString()
                            .padStart(2, '0')
                          return (
                            <option key={channelStr} value={channelStr}>
                              {channel.label || `CH${channelStr}`}
                            </option>
                          )
                        })}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {t('common:buttons.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={hasErrors}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {t('common:buttons.save', { defaultValue: 'Save' })}
          </button>
        </div>
      </div>
    </div>
  )
}

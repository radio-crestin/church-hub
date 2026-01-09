import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Keyboard, Plus, RefreshCw, Video, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppShortcuts } from '~/features/keyboard-shortcuts'
import { ShortcutRecorder } from '~/features/keyboard-shortcuts/components/ShortcutRecorder'
import { ShortcutRecordingProvider } from '~/features/keyboard-shortcuts/context'
import { validateGlobalShortcut } from '~/features/keyboard-shortcuts/utils/shortcutValidation'
import { SceneSettingsItem } from './SceneSettingsItem'
import { SceneSettingsPopup } from './SceneSettingsPopup'
import type { ContentType } from '../constants/content-types'
import { useOBSConnection, useOBSScenes } from '../hooks'
import { useYouTubeConfig } from '../hooks/useYouTubeConfig'
import type { MixerChannelActions, OBSScene } from '../types'

interface LivestreamSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LivestreamSettingsModal({
  isOpen,
  onClose,
}: LivestreamSettingsModalProps) {
  const { t } = useTranslation('livestream')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const isRecordingRef = useRef(false)

  // Scene hooks
  const {
    scenes,
    reorderScenes,
    updateScene,
    createSceneAsync,
    isCreating,
    deleteSceneAsync,
    isDeleting,
    syncScenesAsync,
    isSyncing,
  } = useOBSScenes()
  const { isConnected: isOBSConnected } = useOBSConnection()
  const { config: youtubeConfig, update: updateYouTubeConfig } =
    useYouTubeConfig()

  // Scene settings state
  const [selectedScene, setSelectedScene] = useState<OBSScene | null>(null)
  const [newSceneName, setNewSceneName] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  // Shortcuts state
  const { shortcuts, updateActionShortcuts, isSaving } = useAppShortcuts()
  const [startShortcuts, setStartShortcuts] = useState<string[]>([])
  const [stopShortcuts, setStopShortcuts] = useState<string[]>([])
  const [shortcutErrors, setShortcutErrors] = useState<Record<string, string>>(
    {},
  )

  // Initialize shortcuts from config when opening
  useEffect(() => {
    if (isOpen) {
      setStartShortcuts(shortcuts.actions.startLive?.shortcuts ?? [])
      setStopShortcuts(shortcuts.actions.stopLive?.shortcuts ?? [])
      setShortcutErrors({})
    }
  }, [isOpen, shortcuts])

  // Dialog management
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  // DnD sensors for scene reordering
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const oldIndex = scenes.findIndex((s) => s.id === active.id)
        const newIndex = scenes.findIndex((s) => s.id === over.id)
        const newOrder = arrayMove(scenes, oldIndex, newIndex)
        reorderScenes(newOrder.map((s) => s.id!))
      }
    },
    [scenes, reorderScenes],
  )

  const handleOpenSceneSettings = useCallback((scene: OBSScene) => {
    setSelectedScene(scene)
  }, [])

  const handleCloseScenePopup = useCallback(() => {
    setSelectedScene(null)
  }, [])

  const handleSaveSceneSettings = useCallback(
    (data: {
      displayName: string
      isVisible: boolean
      shortcuts: string[]
      contentTypes: ContentType[]
      mixerChannelActions: MixerChannelActions
    }) => {
      if (selectedScene) {
        updateScene({ id: selectedScene.id!, data })
        setSelectedScene(null)
      }
    },
    [selectedScene, updateScene],
  )

  const handleAddScene = useCallback(async () => {
    if (!newSceneName.trim()) return
    await createSceneAsync(newSceneName.trim())
    setNewSceneName('')
    setShowAddForm(false)
  }, [newSceneName, createSceneAsync])

  const handleDeleteScene = useCallback(async () => {
    if (selectedScene?.id) {
      await deleteSceneAsync(selectedScene.id)
      setSelectedScene(null)
    }
  }, [selectedScene, deleteSceneAsync])

  // Shortcut validation
  const validateShortcut = useCallback(
    (shortcut: string, actionId: string, index: number): string | undefined => {
      // Validate against global shortcuts (excluding current action)
      const conflict = validateGlobalShortcut(shortcut, shortcuts, actionId)
      if (conflict) {
        return t('settings.shortcuts.conflict', {
          name: conflict.conflictName,
          defaultValue: 'Already used by "{{name}}"',
        })
      }

      // Check for conflicts within the same action
      const currentList =
        actionId === 'startLive' ? startShortcuts : stopShortcuts
      const duplicateIndex = currentList.findIndex(
        (s, i) => s === shortcut && i !== index,
      )
      if (duplicateIndex !== -1) {
        return t('settings.shortcuts.duplicate', {
          defaultValue: 'Shortcut already added',
        })
      }

      // Check for conflicts between start and stop
      const otherList =
        actionId === 'startLive' ? stopShortcuts : startShortcuts
      if (otherList.includes(shortcut)) {
        return t('settings.shortcuts.conflictOther', {
          defaultValue: 'Already used by the other action',
        })
      }

      return undefined
    },
    [shortcuts, startShortcuts, stopShortcuts, t],
  )

  // Shortcut handlers
  const handleShortcutChange = useCallback(
    (actionId: 'startLive' | 'stopLive', index: number, value: string) => {
      const setShortcuts =
        actionId === 'startLive' ? setStartShortcuts : setStopShortcuts
      const currentShortcuts =
        actionId === 'startLive' ? startShortcuts : stopShortcuts

      const newShortcuts = [...currentShortcuts]
      newShortcuts[index] = value
      setShortcuts(newShortcuts)

      // Validate and update errors
      const error = validateShortcut(value, actionId, index)
      const errorKey = `${actionId}-${index}`
      setShortcutErrors((prev) => {
        if (error) {
          return { ...prev, [errorKey]: error }
        }
        const { [errorKey]: _, ...rest } = prev
        return rest
      })

      // Save if no error
      if (!error) {
        updateActionShortcuts(actionId, {
          shortcuts: newShortcuts.filter(Boolean),
          enabled: true,
        })
      }
    },
    [startShortcuts, stopShortcuts, validateShortcut, updateActionShortcuts],
  )

  const handleAddShortcut = useCallback(
    (actionId: 'startLive' | 'stopLive') => {
      const setShortcuts =
        actionId === 'startLive' ? setStartShortcuts : setStopShortcuts
      setShortcuts((prev) => [...prev, ''])
    },
    [],
  )

  const handleRemoveShortcut = useCallback(
    (actionId: 'startLive' | 'stopLive', index: number) => {
      const currentShortcuts =
        actionId === 'startLive' ? startShortcuts : stopShortcuts
      const setShortcuts =
        actionId === 'startLive' ? setStartShortcuts : setStopShortcuts

      const newShortcuts = currentShortcuts.filter((_, i) => i !== index)
      setShortcuts(newShortcuts)

      // Clear any errors for this index and update higher indices
      setShortcutErrors((prev) => {
        const updated: Record<string, string> = {}
        Object.entries(prev).forEach(([key, value]) => {
          const [keyAction, keyIndex] = key.split('-')
          if (keyAction === actionId) {
            const idx = parseInt(keyIndex, 10)
            if (idx < index) {
              updated[key] = value
            } else if (idx > index) {
              updated[`${keyAction}-${idx - 1}`] = value
            }
          } else {
            updated[key] = value
          }
        })
        return updated
      })

      // Save immediately
      updateActionShortcuts(actionId, {
        shortcuts: newShortcuts.filter(Boolean),
        enabled: true,
      })
    },
    [startShortcuts, stopShortcuts, updateActionShortcuts],
  )

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onClose()
    }
  }

  const handleRecordingChange = useCallback((recording: boolean) => {
    isRecordingRef.current = recording
  }, [])

  if (!isOpen) return null

  return (
    <ShortcutRecordingProvider onRecordingChange={handleRecordingChange}>
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto w-full max-w-2xl p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
      >
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Video className="w-5 h-5" />
              {t('settings.title', { defaultValue: 'Livestream Settings' })}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Stream Shortcuts Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Keyboard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {t('settings.shortcuts.title', {
                    defaultValue: 'Stream Shortcuts',
                  })}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('settings.shortcuts.description', {
                  defaultValue:
                    'Configure keyboard or MIDI shortcuts to control the livestream.',
                })}
              </p>

              <div className="space-y-4">
                {/* Start Stream Shortcuts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.shortcuts.start', {
                      defaultValue: 'Start Stream',
                    })}
                  </label>
                  <div className="space-y-2">
                    {startShortcuts.map((shortcut, index) => (
                      <ShortcutRecorder
                        key={`start-${index}`}
                        value={shortcut}
                        onChange={(value) =>
                          handleShortcutChange('startLive', index, value)
                        }
                        onRemove={() =>
                          handleRemoveShortcut('startLive', index)
                        }
                        error={shortcutErrors[`startLive-${index}`]}
                        namespace="livestream"
                      />
                    ))}
                    {shortcutErrors[
                      `startLive-${startShortcuts.length - 1}`
                    ] && (
                      <p className="text-xs text-red-500">
                        {
                          shortcutErrors[
                            `startLive-${startShortcuts.length - 1}`
                          ]
                        }
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddShortcut('startLive')}
                      disabled={isSaving}
                      className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      <Plus size={16} />
                      {t('settings.shortcuts.addShortcut', {
                        defaultValue: 'Add Shortcut',
                      })}
                    </button>
                  </div>
                </div>

                {/* Stop Stream Shortcuts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.shortcuts.stop', {
                      defaultValue: 'Stop Stream',
                    })}
                  </label>
                  <div className="space-y-2">
                    {stopShortcuts.map((shortcut, index) => (
                      <ShortcutRecorder
                        key={`stop-${index}`}
                        value={shortcut}
                        onChange={(value) =>
                          handleShortcutChange('stopLive', index, value)
                        }
                        onRemove={() => handleRemoveShortcut('stopLive', index)}
                        error={shortcutErrors[`stopLive-${index}`]}
                        namespace="livestream"
                      />
                    ))}
                    {shortcutErrors[`stopLive-${stopShortcuts.length - 1}`] && (
                      <p className="text-xs text-red-500">
                        {shortcutErrors[`stopLive-${stopShortcuts.length - 1}`]}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddShortcut('stopLive')}
                      disabled={isSaving}
                      className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      <Plus size={16} />
                      {t('settings.shortcuts.addShortcut', {
                        defaultValue: 'Add Shortcut',
                      })}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Scenes Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {t('scenes.title')}
                </h3>
                <button
                  type="button"
                  onClick={() => syncScenesAsync()}
                  disabled={isSyncing || !isOBSConnected}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                  title={!isOBSConnected ? t('obs.disconnected') : undefined}
                >
                  <RefreshCw
                    size={14}
                    className={isSyncing ? 'animate-spin' : ''}
                  />
                  {t('scenes.syncFromOBS')}
                </button>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={scenes.map((s) => s.id!)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {scenes.map((scene) => (
                      <SceneSettingsItem
                        key={scene.id}
                        scene={scene}
                        onOpenSettings={() => handleOpenSceneSettings(scene)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Add custom scene */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {showAddForm ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSceneName}
                      onChange={(e) => setNewSceneName(e.target.value)}
                      placeholder={t('scenes.newScenePlaceholder')}
                      className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddScene()
                        if (e.key === 'Escape') {
                          setShowAddForm(false)
                          setNewSceneName('')
                        }
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddScene}
                      disabled={!newSceneName.trim() || isCreating}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      {isCreating ? t('scenes.adding') : t('scenes.add')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false)
                        setNewSceneName('')
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Plus size={18} />
                    {t('scenes.addCustomScene')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </dialog>

      {/* Scene Settings Popup */}
      {selectedScene && (
        <SceneSettingsPopup
          scene={selectedScene}
          allScenes={scenes}
          youtubeConfig={youtubeConfig}
          onUpdateYouTubeConfig={updateYouTubeConfig}
          onClose={handleCloseScenePopup}
          onSave={handleSaveSceneSettings}
          onDelete={handleDeleteScene}
          isDeleting={isDeleting}
        />
      )}
    </ShortcutRecordingProvider>
  )
}

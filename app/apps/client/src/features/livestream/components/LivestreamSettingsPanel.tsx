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
import { Plus, RefreshCw, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SceneSettingsItem } from './SceneSettingsItem'
import { SceneSettingsPopup } from './SceneSettingsPopup'
import type { ContentType } from '../constants/content-types'
import { useOBSConnection, useOBSScenes } from '../hooks'
import { useYouTubeConfig } from '../hooks/useYouTubeConfig'
import type { MixerChannelActions, OBSScene } from '../types'

const cardClass =
  'rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900'

/**
 * Livestream settings panel: OBS scene management. Start/stop stream shortcuts
 * moved to the consolidated Shortcuts settings page (/settings/shortcuts).
 */
export function LivestreamSettingsPanel() {
  const { t } = useTranslation('livestream')

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

  const [selectedScene, setSelectedScene] = useState<OBSScene | null>(null)
  const [newSceneName, setNewSceneName] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

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

  return (
    <>
      <div className={`flex-1 ${cardClass}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium text-gray-900 dark:text-white">
            {t('scenes.title')}
          </h3>
          <button
            type="button"
            onClick={() => syncScenesAsync()}
            disabled={isSyncing || !isOBSConnected}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
            title={!isOBSConnected ? t('obs.disconnected') : undefined}
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
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

        <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
          {showAddForm ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                placeholder={t('scenes.newScenePlaceholder')}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
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
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? t('scenes.adding') : t('scenes.add')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setNewSceneName('')
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <Plus size={18} />
              {t('scenes.addCustomScene')}
            </button>
          )}
        </div>
      </div>

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
    </>
  )
}

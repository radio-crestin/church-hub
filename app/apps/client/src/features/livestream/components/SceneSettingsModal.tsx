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
import { useYouTubeConfig } from '../hooks/useYouTubeConfig'
import type { MixerChannelActions, OBSScene } from '../types'

interface SceneSettingsModalProps {
  scenes: OBSScene[]
  onClose: () => void
  onReorder: (sceneIds: number[]) => void
  onUpdateScene: (
    id: number,
    data: {
      displayName?: string
      isVisible?: boolean
      shortcuts?: string[]
      contentTypes?: ContentType[]
      mixerChannelActions?: MixerChannelActions
    },
  ) => void
  onCreateScene: (sceneName: string) => Promise<void>
  isCreating?: boolean
  onDeleteScene: (id: number) => Promise<void>
  isDeleting?: boolean
  onSyncScenes: () => Promise<void>
  isSyncing?: boolean
  isOBSConnected?: boolean
}

export function SceneSettingsModal({
  scenes,
  onClose,
  onReorder,
  onUpdateScene,
  onCreateScene,
  isCreating,
  onDeleteScene,
  isDeleting,
  onSyncScenes,
  isSyncing,
  isOBSConnected,
}: SceneSettingsModalProps) {
  const { t } = useTranslation('livestream')
  const [selectedScene, setSelectedScene] = useState<OBSScene | null>(null)
  const [newSceneName, setNewSceneName] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const { config: youtubeConfig, update: updateYouTubeConfig } =
    useYouTubeConfig()

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
        onReorder(newOrder.map((s) => s.id!))
      }
    },
    [scenes, onReorder],
  )

  const handleOpenSettings = useCallback((scene: OBSScene) => {
    setSelectedScene(scene)
  }, [])

  const handleClosePopup = useCallback(() => {
    setSelectedScene(null)
  }, [])

  const handleSaveSettings = useCallback(
    (data: {
      displayName: string
      isVisible: boolean
      shortcuts: string[]
      contentTypes: ContentType[]
      mixerChannelActions: MixerChannelActions
    }) => {
      if (selectedScene) {
        onUpdateScene(selectedScene.id!, data)
        setSelectedScene(null)
      }
    },
    [selectedScene, onUpdateScene],
  )

  const handleAddScene = useCallback(async () => {
    if (!newSceneName.trim()) return
    await onCreateScene(newSceneName.trim())
    setNewSceneName('')
    setShowAddForm(false)
  }, [newSceneName, onCreateScene])

  const handleDeleteScene = useCallback(async () => {
    if (selectedScene?.id) {
      await onDeleteScene(selectedScene.id)
      setSelectedScene(null)
    }
  }, [selectedScene, onDeleteScene])

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('scenes.settings')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSyncScenes()}
                disabled={isSyncing || !isOBSConnected}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                title={!isOBSConnected ? t('obs.disconnected') : undefined}
              >
                <RefreshCw
                  size={16}
                  className={isSyncing ? 'animate-spin' : ''}
                />
                {t('scenes.syncFromOBS')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
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
                      onOpenSettings={() => handleOpenSettings(scene)}
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
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

      {selectedScene && (
        <SceneSettingsPopup
          scene={selectedScene}
          allScenes={scenes}
          youtubeConfig={youtubeConfig}
          onUpdateYouTubeConfig={updateYouTubeConfig}
          onClose={handleClosePopup}
          onSave={handleSaveSettings}
          onDelete={handleDeleteScene}
          isDeleting={isDeleting}
        />
      )}
    </>
  )
}

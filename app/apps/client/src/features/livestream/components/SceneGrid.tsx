import { Settings } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SceneCard } from './SceneCard'
import { SceneSettingsModal } from './SceneSettingsModal'
import { useOBSConnection, useOBSScenes } from '../hooks'

export function SceneGrid() {
  const { t } = useTranslation('livestream')
  const {
    scenes,
    isLoading,
    switchScene,
    reorderScenes,
    updateScene,
    createSceneAsync,
    isCreating,
    deleteSceneAsync,
    isDeleting,
    syncScenesAsync,
    isSyncing,
  } = useOBSScenes()
  const { isConnected } = useOBSConnection()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const visibleScenes = scenes.filter((s) => s.isVisible)

  const handleReorder = useCallback(
    (sceneIds: number[]) => {
      reorderScenes(sceneIds)
    },
    [reorderScenes],
  )

  const handleUpdateScene = useCallback(
    (id: number, data: { displayName?: string; isVisible?: boolean }) => {
      updateScene({ id, data })
    },
    [updateScene],
  )

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('scenes.title')}
          </h2>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={t('scenes.settings')}
          >
            <Settings size={20} />
          </button>
        </div>
        {visibleScenes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <p>{t('scenes.noScenes')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleScenes.map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                onSwitch={switchScene}
                isOBSConnected={isConnected}
              />
            ))}
          </div>
        )}
      </div>

      {isSettingsOpen && (
        <SceneSettingsModal
          scenes={scenes}
          onClose={() => setIsSettingsOpen(false)}
          onReorder={handleReorder}
          onUpdateScene={handleUpdateScene}
          onCreateScene={createSceneAsync}
          isCreating={isCreating}
          onDeleteScene={deleteSceneAsync}
          isDeleting={isDeleting}
          onSyncScenes={syncScenesAsync}
          isSyncing={isSyncing}
          isOBSConnected={isConnected}
        />
      )}
    </>
  )
}

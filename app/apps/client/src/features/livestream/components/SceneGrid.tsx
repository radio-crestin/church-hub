import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SceneCard } from './SceneCard'
import { SceneConfigModal } from './SceneConfigModal'
import { useOBSScenes } from '../hooks'
import type { OBSScene } from '../types'

export function SceneGrid() {
  const { t } = useTranslation('livestream')
  const {
    scenes,
    isLoading,
    switchScene,
    isSwitching,
    reorderScenes,
    updateScene,
  } = useOBSScenes()
  const [configScene, setConfigScene] = useState<OBSScene | null>(null)

  const visibleScenes = scenes.filter((s) => s.isVisible)

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return
      const newOrder = [...visibleScenes]
      const temp = newOrder[index]
      newOrder[index] = newOrder[index - 1]
      newOrder[index - 1] = temp
      reorderScenes(newOrder.map((s) => s.id!))
    },
    [visibleScenes, reorderScenes],
  )

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index === visibleScenes.length - 1) return
      const newOrder = [...visibleScenes]
      const temp = newOrder[index]
      newOrder[index] = newOrder[index + 1]
      newOrder[index + 1] = temp
      reorderScenes(newOrder.map((s) => s.id!))
    },
    [visibleScenes, reorderScenes],
  )

  const handleSaveConfig = useCallback(
    (data: { displayName?: string; isVisible?: boolean }) => {
      if (configScene?.id) {
        updateScene({ id: configScene.id, data })
      }
      setConfigScene(null)
    },
    [configScene, updateScene],
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

  if (visibleScenes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p>No scenes available. Connect to OBS to see scenes.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('scenes.title')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleScenes.map((scene, index) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              onSwitch={switchScene}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              onConfigure={() => setConfigScene(scene)}
              isFirst={index === 0}
              isLast={index === visibleScenes.length - 1}
              isSwitching={isSwitching}
            />
          ))}
        </div>
      </div>

      {configScene && (
        <SceneConfigModal
          scene={configScene}
          onClose={() => setConfigScene(null)}
          onSave={handleSaveConfig}
        />
      )}
    </>
  )
}

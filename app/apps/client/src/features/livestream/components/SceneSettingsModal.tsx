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
import { X } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { SceneSettingsItem } from './SceneSettingsItem'
import type { OBSScene } from '../types'

interface SceneSettingsModalProps {
  scenes: OBSScene[]
  onClose: () => void
  onReorder: (sceneIds: number[]) => void
  onUpdateScene: (
    id: number,
    data: { displayName?: string; isVisible?: boolean },
  ) => void
}

export function SceneSettingsModal({
  scenes,
  onClose,
  onReorder,
  onUpdateScene,
}: SceneSettingsModalProps) {
  const { t } = useTranslation('livestream')

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

  const handleToggleVisibility = useCallback(
    (scene: OBSScene) => {
      onUpdateScene(scene.id!, { isVisible: !scene.isVisible })
    },
    [onUpdateScene],
  )

  const handleUpdateDisplayName = useCallback(
    (scene: OBSScene, displayName: string) => {
      onUpdateScene(scene.id!, { displayName })
    },
    [onUpdateScene],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('scenes.settings')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
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
                    onToggleVisibility={() => handleToggleVisibility(scene)}
                    onUpdateDisplayName={(displayName) =>
                      handleUpdateDisplayName(scene, displayName)
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  )
}

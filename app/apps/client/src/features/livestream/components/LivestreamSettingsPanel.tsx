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

import { Button } from '~/ui/button'
import { SceneSettingsItem } from './SceneSettingsItem'
import { useOBSConnection, useOBSScenes } from '../hooks'

const cardClass = 'rounded-xl border border-line bg-panel p-4 sm:p-6'

/**
 * Livestream settings panel: OBS scene management. Start/stop stream shortcuts
 * moved to the consolidated Shortcuts settings page (/settings/shortcuts).
 */
export function LivestreamSettingsPanel() {
  const { t } = useTranslation('livestream')

  const {
    scenes,
    reorderScenes,
    createSceneAsync,
    isCreating,
    syncScenesAsync,
    isSyncing,
  } = useOBSScenes()
  const { isConnected: isOBSConnected } = useOBSConnection()
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

  const handleAddScene = useCallback(async () => {
    if (!newSceneName.trim()) return
    await createSceneAsync(newSceneName.trim())
    setNewSceneName('')
    setShowAddForm(false)
  }, [newSceneName, createSceneAsync])

  return (
    <div className={`flex-1 ${cardClass}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-fg">{t('scenes.title')}</h3>
        <Button
          type="button"
          size="sm"
          onClick={() => syncScenesAsync()}
          disabled={isSyncing || !isOBSConnected}
          title={!isOBSConnected ? t('obs.disconnected') : undefined}
        >
          <RefreshCw
            size={14}
            strokeWidth={1.75}
            className={isSyncing ? 'animate-spin' : ''}
          />
          {t('scenes.syncFromOBS')}
        </Button>
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
              <SceneSettingsItem key={scene.id} scene={scene} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-4 border-t border-line pt-4">
        {showAddForm ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newSceneName}
              onChange={(e) => setNewSceneName(e.target.value)}
              placeholder={t('scenes.newScenePlaceholder')}
              className="flex-1 rounded-[10px] bg-field px-3 py-2 text-sm text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddScene()
                if (e.key === 'Escape') {
                  setShowAddForm(false)
                  setNewSceneName('')
                }
              }}
              autoFocus
            />
            <Button
              type="button"
              onClick={handleAddScene}
              disabled={!newSceneName.trim() || isCreating}
            >
              {isCreating ? t('scenes.adding') : t('scenes.add')}
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setNewSceneName('')
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-label transition-colors hover:bg-hover hover:text-fg"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg-label transition-colors hover:bg-hover hover:text-fg"
          >
            <Plus size={16} strokeWidth={1.5} />
            {t('scenes.addCustomScene')}
          </button>
        )}
      </div>
    </div>
  )
}

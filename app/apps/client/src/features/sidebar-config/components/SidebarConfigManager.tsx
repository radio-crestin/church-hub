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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Loader2, PanelLeft, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { CustomPageFormModal } from './CustomPageFormModal'
import { SidebarItemCard } from './SidebarItemCard'
import {
  SidebarItemSettingsModal,
  type SidebarItemSettingsUpdate,
} from './SidebarItemSettingsModal'
import { getDefaultSidebarItemSettings } from '../constants'
import { useSidebarConfig } from '../hooks/useSidebarConfig'
import { generateCustomPageId } from '../service/sidebarConfig'
import type {
  CustomPageInput,
  CustomPageMenuItem,
  SidebarMenuItem,
} from '../types'

/**
 * Main component for managing sidebar configuration in settings
 */
export function SidebarConfigManager() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()

  const { config, isLoading, updateConfig } = useSidebarConfig()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [settingsItem, setSettingsItem] = useState<SidebarMenuItem | null>(null)
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || !config || active.id === over.id) {
      return
    }

    const items = [...config.items]
    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Reorder items
    const [removed] = items.splice(oldIndex, 1)
    items.splice(newIndex, 0, removed)

    // Update order values
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index,
    }))

    updateConfig.mutate(
      { ...config, items: updatedItems },
      {
        onSuccess: () => {
          showToast(t('sections.sidebar.toast.saved'), 'success')
        },
        onError: () => {
          showToast(t('sections.sidebar.toast.error'), 'error')
        },
      },
    )
  }

  const handleToggleVisibility = (itemId: string) => {
    if (!config) return

    const updatedItems = config.items.map((item) =>
      item.id === itemId ? { ...item, isVisible: !item.isVisible } : item,
    )

    updateConfig.mutate(
      { ...config, items: updatedItems },
      {
        onSuccess: () => {
          showToast(t('sections.sidebar.toast.saved'), 'success')
        },
        onError: () => {
          showToast(t('sections.sidebar.toast.error'), 'error')
        },
      },
    )
  }

  const handleCreateCustomPage = (input: CustomPageInput) => {
    if (!config) return

    const newPage: CustomPageMenuItem = {
      id: generateCustomPageId(),
      type: 'custom',
      title: input.title,
      url: input.url,
      iconName: input.iconName,
      useIframeEmbedding: input.useIframeEmbedding,
      customIconUrl: input.customIconUrl,
      iconSource: input.iconSource ?? 'favicon',
      faviconColor: input.faviconColor,
      order: config.items.length,
      isVisible: true,
      settings: getDefaultSidebarItemSettings(),
    }

    const updatedItems = [...config.items, newPage]

    updateConfig.mutate(
      { ...config, items: updatedItems },
      {
        onSuccess: () => {
          setIsCreateModalOpen(false)
          showToast(t('sections.sidebar.toast.customPageCreated'), 'success')
        },
        onError: () => {
          showToast(t('sections.sidebar.toast.error'), 'error')
        },
      },
    )
  }

  const handleSaveSettings = (updates: SidebarItemSettingsUpdate) => {
    if (!config) return

    const updatedItems = config.items.map((item) => {
      if (item.id !== updates.itemId) return item

      // Update base properties
      const baseUpdate = {
        ...item,
        isVisible: updates.isVisible,
        settings: updates.settings,
      }

      // For custom pages, also update custom fields
      if (item.type === 'custom' && updates.customPageData) {
        return {
          ...baseUpdate,
          title: updates.customPageData.title,
          url: updates.customPageData.url,
          iconName: updates.customPageData.iconName,
          useIframeEmbedding: updates.customPageData.useIframeEmbedding,
          customIconUrl: updates.customPageData.customIconUrl,
          iconSource: updates.customPageData.iconSource,
          faviconColor: updates.customPageData.faviconColor,
        } as CustomPageMenuItem
      }

      return baseUpdate
    })

    updateConfig.mutate(
      { ...config, items: updatedItems },
      {
        onSuccess: () => {
          setSettingsItem(null)
          showToast(t('sections.sidebar.toast.saved'), 'success')
        },
        onError: () => {
          showToast(t('sections.sidebar.toast.error'), 'error')
        },
      },
    )
  }

  const handleDeleteCustomPage = () => {
    if (!config || !deletingPageId) return

    const updatedItems = config.items
      .filter((item) => item.id !== deletingPageId)
      .map((item, index) => ({ ...item, order: index }))

    updateConfig.mutate(
      { ...config, items: updatedItems },
      {
        onSuccess: () => {
          setDeletingPageId(null)
          showToast(t('sections.sidebar.toast.customPageDeleted'), 'success')
        },
        onError: () => {
          showToast(t('sections.sidebar.toast.error'), 'error')
        },
      },
    )
  }

  // Filter out settings - it's fixed at the bottom and not configurable
  const sortedItems = config?.items
    ? [...config.items]
        .filter((item) => item.id !== 'settings')
        .sort((a, b) => a.order - b.order)
    : []

  const deletingPage = deletingPageId
    ? (sortedItems.find(
        (item) => item.id === deletingPageId && item.type === 'custom',
      ) as CustomPageMenuItem | undefined)
    : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <PanelLeft className="w-5 h-5" />
            {t('sections.sidebar.title')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('sections.sidebar.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          {t('sections.sidebar.addCustomPage')}
        </button>
      </div>

      {/* Items List with Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedItems.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {sortedItems.map((item) => (
              <SidebarItemCard
                key={item.id}
                item={item}
                onToggleVisibility={() => handleToggleVisibility(item.id)}
                onOpenSettings={() => setSettingsItem(item)}
                onDelete={
                  item.type === 'custom'
                    ? () => setDeletingPageId(item.id)
                    : undefined
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Create Custom Page Modal */}
      <CustomPageFormModal
        isOpen={isCreateModalOpen}
        onSubmit={handleCreateCustomPage}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Sidebar Item Settings Modal */}
      <SidebarItemSettingsModal
        isOpen={!!settingsItem}
        item={settingsItem}
        onSave={handleSaveSettings}
        onDelete={
          settingsItem?.type === 'custom'
            ? () => {
                setDeletingPageId(settingsItem.id)
                setSettingsItem(null)
              }
            : undefined
        }
        onClose={() => setSettingsItem(null)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingPageId}
        title={t('sections.sidebar.modals.delete.title')}
        message={t('sections.sidebar.modals.delete.message', {
          name: deletingPage?.title ?? '',
        })}
        confirmLabel={t('sections.sidebar.modals.delete.confirm')}
        onConfirm={handleDeleteCustomPage}
        onCancel={() => setDeletingPageId(null)}
        variant="danger"
      />
    </div>
  )
}

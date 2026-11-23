import { Loader2, MonitorUp, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import { Combobox } from '~/ui/combobox/Combobox'
import { PageHeader } from '~/ui/page'
import { useToast } from '~/ui/toast/useToast'
import { ScreenCard } from './ScreenCard'
import { ScreenExportModal } from './ScreenExportModal'
import {
  useBatchUpdateScreenConfig,
  useDeleteScreen,
  useDuplicateScreen,
  useScreen,
  useScreens,
  useUpsertScreen,
} from '../../hooks'
import type {
  ContentType,
  Screen,
  ScreenType,
  ScreenWithConfigs,
} from '../../types'
import {
  closeDisplayWindow,
  getFrontendUrl,
} from '../../utils/openDisplayWindow'
import { resolvePreviewScreen } from '../../utils/resolvePreviewScreen'
import { ScreenEditor } from '../screen-editor'

export function ScreenManager() {
  const { t } = useTranslation(['settings', 'presentation'])
  const { showToast } = useToast()

  // Translated screen type options
  const screenTypeOptions = useMemo(
    () => [
      {
        value: 'primary' as ScreenType,
        label: t('presentation:screens.screenTypes.primary'),
      },
      {
        value: 'stage' as ScreenType,
        label: t('presentation:screens.screenTypes.stage'),
      },
      {
        value: 'livestream' as ScreenType,
        label: t('presentation:screens.screenTypes.livestream'),
      },
      {
        value: 'kiosk' as ScreenType,
        label: t('presentation:screens.screenTypes.kiosk'),
      },
    ],
    [t],
  )

  const { data: screens, isLoading } = useScreens()
  const previewScreenId = resolvePreviewScreen(screens)?.id
  const upsertScreen = useUpsertScreen()
  const deleteScreen = useDeleteScreen()
  const duplicateScreen = useDuplicateScreen()
  const batchUpdateConfig = useBatchUpdateScreenConfig()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newScreenName, setNewScreenName] = useState('')
  const [newScreenType, setNewScreenType] = useState<ScreenType>('primary')
  const [editingScreenId, setEditingScreenId] = useState<number | null>(null)
  // The slide type the editor opens on (the empty slide from its thumbnail)
  const [editingContentType, setEditingContentType] = useState<
    ContentType | undefined
  >()
  const [deleteConfirm, setDeleteConfirm] = useState<Screen | null>(null)
  const [exportScreen, setExportScreen] = useState<Screen | null>(null)

  // Fetch full screen config when editing
  const { data: editingScreen } = useScreen(editingScreenId)

  const handleAddNew = () => {
    setNewScreenName('')
    setNewScreenType('primary')
    setIsAddModalOpen(true)
  }

  const handleCreateScreen = async () => {
    if (!newScreenName.trim()) return

    try {
      const screen = await upsertScreen.mutateAsync({
        name: newScreenName.trim(),
        type: newScreenType,
      })
      setIsAddModalOpen(false)
      if (screen) {
        setEditingScreenId(screen.id)
      }
      showToast(t('settings:sections.screens.toast.created'), 'success')
    } catch {
      showToast(t('settings:sections.screens.toast.createError'), 'error')
    }
  }

  const handleEdit = (screen: Screen, contentType?: ContentType) => {
    setEditingContentType(contentType)
    setEditingScreenId(screen.id)
  }

  const handleSaveScreen = useCallback(
    async (screen: ScreenWithConfigs) => {
      try {
        // Single atomic batch update of all screen configs
        await batchUpdateConfig.mutateAsync({
          screenId: screen.id,
          globalSettings: screen.globalSettings,
          contentConfigs: screen.contentConfigs,
          nextSlideConfig: screen.nextSlideConfig,
          width: screen.width,
          height: screen.height,
        })

        showToast(t('settings:sections.screens.toast.saved'), 'success')
      } catch {
        showToast(t('settings:sections.screens.toast.saveError'), 'error')
      }
    },
    [batchUpdateConfig, showToast],
  )

  const handleCloseEditor = () => {
    setEditingScreenId(null)
  }

  const handleDelete = (screen: Screen) => {
    setDeleteConfirm(screen)
  }

  const handleCopyUrl = async (screen: Screen) => {
    const url = `${getFrontendUrl()}/screen/${screen.id}`
    try {
      await navigator.clipboard.writeText(url)
      showToast(t('settings:sections.screens.toast.urlCopied'), 'success')
    } catch {
      showToast(t('settings:sections.screens.toast.copyError'), 'error')
    }
  }

  // Duplicating happens entirely server-side so the copy gets every content
  // config, the next-slide config and the OBS scene overrides in one write.
  const handleDuplicate = async (screen: Screen) => {
    try {
      const copy = await duplicateScreen.mutateAsync(screen.id)
      showToast(
        t('settings:sections.screens.toast.duplicated', { name: copy.name }),
        'success',
      )
    } catch {
      showToast(t('settings:sections.screens.toast.duplicateError'), 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      // Close the window first if it's open
      await closeDisplayWindow(deleteConfirm.id)

      await deleteScreen.mutateAsync(deleteConfirm.id)
      setDeleteConfirm(null)
      showToast(t('settings:sections.screens.toast.deleted'), 'success')
    } catch {
      showToast(t('settings:sections.screens.toast.deleteError'), 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  // Full-screen editor mode
  if (editingScreenId && editingScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950">
        <ScreenEditor
          screen={editingScreen}
          initialContentType={editingContentType}
          onSave={handleSaveScreen}
          onClose={handleCloseEditor}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('settings:sections.screens.title')}
        description={t('settings:sections.screens.description')}
        actions={
          <Button onClick={handleAddNew} variant="primary" className="gap-2">
            <Plus size={16} />
            {t('settings:sections.screens.addScreen')}
          </Button>
        }
      />

      {/* Screens List */}
      {screens && screens.length > 0 ? (
        <div className="space-y-3">
          {screens.map((screen) => (
            <ScreenCard
              key={screen.id}
              screen={screen}
              onEdit={(contentType) => handleEdit(screen, contentType)}
              onExport={() => setExportScreen(screen)}
              onCopyUrl={() => handleCopyUrl(screen)}
              onDuplicate={() => handleDuplicate(screen)}
              onDelete={() => handleDelete(screen)}
              isDuplicating={duplicateScreen.isPending}
              isShownInPreviews={screen.id === previewScreenId}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <MonitorUp
            size={48}
            className="mx-auto text-gray-400 dark:text-gray-500 mb-4"
          />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('settings:sections.screens.noScreens')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('presentation:screens.noScreensDescription')}
          </p>
          <Button onClick={handleAddNew} variant="primary">
            <Plus size={20} className="mr-2" />
            {t('presentation:screens.addFirstScreen')}
          </Button>
        </div>
      )}

      {/* Add Screen Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('settings:sections.screens.addScreen')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('presentation:screens.screenName')}
                </label>
                <input
                  type="text"
                  value={newScreenName}
                  onChange={(e) => setNewScreenName(e.target.value)}
                  placeholder={t('presentation:screens.screenNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('presentation:screens.screenType')}
                </label>
                <Combobox
                  value={newScreenType}
                  onChange={(value) => setNewScreenType(value as ScreenType)}
                  options={screenTypeOptions}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                {t('presentation:actions.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateScreen}
                disabled={!newScreenName.trim() || upsertScreen.isPending}
              >
                {upsertScreen.isPending && (
                  <Loader2 size={16} className="animate-spin mr-2" />
                )}
                {t('presentation:screens.createAndConfigure')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('presentation:screens.deleteConfirmTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('presentation:screens.deleteConfirmMessage', {
                name: deleteConfirm.name,
              })}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
                {t('presentation:actions.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                disabled={deleteScreen.isPending}
              >
                {deleteScreen.isPending && (
                  <Loader2 size={16} className="animate-spin mr-2" />
                )}
                {t('presentation:actions.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Screen Export Modal */}
      {exportScreen && (
        <ScreenExportModal
          isOpen={!!exportScreen}
          onClose={() => setExportScreen(null)}
          screen={exportScreen}
        />
      )}
    </div>
  )
}

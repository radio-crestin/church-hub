import {
  AppWindow,
  Copy,
  Edit,
  ExternalLink,
  Loader2,
  MonitorUp,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import { Combobox } from '~/ui/combobox/Combobox'
import { useToast } from '~/ui/toast/useToast'
import { ScreenExportModal } from './ScreenExportModal'
import {
  useBatchUpdateScreenConfig,
  useDeleteScreen,
  useScreen,
  useScreens,
  useUpsertScreen,
} from '../../hooks'
import type { Screen, ScreenType, ScreenWithConfigs } from '../../types'
import {
  closeDisplayWindow,
  getFrontendUrl,
  openDisplayWindow,
  setDisplayAlwaysOnTop,
} from '../../utils/openDisplayWindow'
import { ScreenEditor } from '../screen-editor'

const SCREEN_TYPE_COLORS: Record<ScreenType, string> = {
  primary: 'bg-blue-600',
  stage: 'bg-purple-600',
  livestream: 'bg-green-600',
  kiosk: 'bg-orange-600',
}

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
      { value: 'kiosk' as ScreenType, label: 'Kiosk' },
    ],
    [t],
  )

  const { data: screens, isLoading } = useScreens()
  const upsertScreen = useUpsertScreen()
  const deleteScreen = useDeleteScreen()
  const batchUpdateConfig = useBatchUpdateScreenConfig()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newScreenName, setNewScreenName] = useState('')
  const [newScreenType, setNewScreenType] = useState<ScreenType>('primary')
  const [editingScreenId, setEditingScreenId] = useState<number | null>(null)
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

  const handleEdit = (screen: Screen) => {
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

  // Toggle window open/close (persisted to database via isActive field)
  const handleToggleWindow = async (screen: Screen) => {
    const isCurrentlyActive = screen.isActive

    try {
      if (isCurrentlyActive) {
        // Close the native window and update database
        await closeDisplayWindow(screen.id)
        await upsertScreen.mutateAsync({
          id: screen.id,
          name: screen.name,
          type: screen.type,
          isActive: false,
        })
        showToast(
          t('settings:sections.screens.toast.windowClosed', {
            name: screen.name,
          }),
          'success',
        )
      } else {
        // Update database first, then open the native window
        await upsertScreen.mutateAsync({
          id: screen.id,
          name: screen.name,
          type: screen.type,
          isActive: true,
        })
        await openDisplayWindow(
          screen.id,
          'native',
          screen.isFullscreen,
          screen.name,
          screen.alwaysOnTop,
        )
        showToast(
          t('settings:sections.screens.toast.windowOpened', {
            name: screen.name,
          }),
          'success',
        )
      }
    } catch {
      showToast(t('settings:sections.screens.toast.toggleError'), 'error')
    }
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

  const handleToggleAlwaysOnTop = async (screen: Screen) => {
    const newValue = !screen.alwaysOnTop

    try {
      // Update in database
      await upsertScreen.mutateAsync({
        id: screen.id,
        name: screen.name,
        type: screen.type,
        alwaysOnTop: newValue,
      })

      // If window is active, update it immediately
      if (screen.isActive) {
        await setDisplayAlwaysOnTop(screen.id, newValue)
      }

      showToast(
        newValue
          ? t('sections.screens.alwaysOnTop.pinned')
          : t('sections.screens.alwaysOnTop.unpinned'),
        'success',
      )
    } catch {
      showToast(t('sections.screens.alwaysOnTop.error'), 'error')
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
          onSave={handleSaveScreen}
          onClose={handleCloseEditor}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MonitorUp size={24} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('settings:sections.screens.title')}
          </h1>
        </div>
        <Button onClick={handleAddNew} variant="primary">
          <Plus size={20} className="mr-2" />
          {t('settings:sections.screens.addScreen')}
        </Button>
      </div>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-400">
        {t('settings:sections.screens.description')}
      </p>

      {/* Screens List */}
      {screens && screens.length > 0 ? (
        <div className="space-y-3">
          {screens.map((screen) => (
            <div
              key={screen.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 md:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 md:gap-4">
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    screen.isActive ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {screen.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full text-white ${SCREEN_TYPE_COLORS[screen.type]}`}
                    >
                      {screen.type}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {screen.width}×{screen.height}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={screen.isActive ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleToggleWindow(screen)}
                  title={
                    screen.isActive
                      ? t('sections.screens.window.closeTooltip')
                      : t('sections.screens.window.openTooltip')
                  }
                >
                  <AppWindow size={16} />
                  <span className="ml-1">
                    {screen.isActive
                      ? t('sections.screens.window.active')
                      : t('sections.screens.window.inactive')}
                  </span>
                </Button>
                <Button
                  variant={screen.alwaysOnTop ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleToggleAlwaysOnTop(screen)}
                  title={
                    screen.alwaysOnTop
                      ? t('sections.screens.alwaysOnTop.unpin')
                      : t('sections.screens.alwaysOnTop.pin')
                  }
                >
                  {screen.alwaysOnTop ? (
                    <Pin size={16} />
                  ) : (
                    <PinOff size={16} />
                  )}
                  <span className="ml-1">
                    {screen.alwaysOnTop
                      ? t('sections.screens.alwaysOnTop.enabled')
                      : t('sections.screens.alwaysOnTop.disabled')}
                  </span>
                </Button>
                <div className="hidden md:block h-6 w-px bg-gray-200 dark:bg-gray-700" />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExportScreen(screen)}
                    title={t('sections.screens.export.title')}
                  >
                    <ExternalLink size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyUrl(screen)}
                    title={t('sections.screens.actions.copyUrl')}
                  >
                    <Copy size={16} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEdit(screen)}
                    title={t('sections.screens.actions.edit')}
                  >
                    <Edit size={16} />
                    <span className="ml-1">
                      {t('sections.screens.actions.edit')}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(screen)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title={t('sections.screens.actions.delete')}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </div>
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

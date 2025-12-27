import {
  Copy,
  Edit,
  ExternalLink,
  Loader2,
  MonitorUp,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '~/ui/button/Button'
import { Combobox } from '~/ui/combobox/Combobox'
import { Switch } from '~/ui/switch/Switch'
import { useToast } from '~/ui/toast/useToast'
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
  openInBrowser,
} from '../../utils/openDisplayWindow'
import { ScreenEditor } from '../screen-editor'

const SCREEN_TYPE_OPTIONS: { value: ScreenType; label: string }[] = [
  { value: 'primary', label: 'Primary / Audience' },
  { value: 'stage', label: 'Stage Monitor' },
  { value: 'livestream', label: 'Live Stream' },
  { value: 'kiosk', label: 'Kiosk' },
]

const SCREEN_TYPE_COLORS: Record<ScreenType, string> = {
  primary: 'bg-blue-600',
  stage: 'bg-purple-600',
  livestream: 'bg-green-600',
  kiosk: 'bg-orange-600',
}

export function ScreenManager() {
  const { showToast } = useToast()

  const { data: screens, isLoading } = useScreens()
  const upsertScreen = useUpsertScreen()
  const deleteScreen = useDeleteScreen()
  const batchUpdateConfig = useBatchUpdateScreenConfig()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newScreenName, setNewScreenName] = useState('')
  const [newScreenType, setNewScreenType] = useState<ScreenType>('primary')
  const [editingScreenId, setEditingScreenId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Screen | null>(null)

  // Track which windows are currently open (local state, not persisted)
  const [openWindows, setOpenWindows] = useState<Set<number>>(new Set())

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
      showToast('Screen created successfully', 'success')
    } catch {
      showToast('Failed to create screen', 'error')
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
          nextSlideConfig:
            screen.type === 'stage' ? screen.nextSlideConfig : undefined,
        })

        showToast('Screen saved successfully', 'success')
      } catch {
        showToast('Failed to save screen', 'error')
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

  // Toggle window open/close (local state only, no database update)
  const handleToggleWindow = async (screen: Screen) => {
    const isCurrentlyOpen = openWindows.has(screen.id)

    try {
      if (isCurrentlyOpen) {
        // Close the native window
        await closeDisplayWindow(screen.id)
        setOpenWindows((prev) => {
          const next = new Set(prev)
          next.delete(screen.id)
          return next
        })
        showToast(`Window "${screen.name}" closed`, 'success')
      } else {
        // Open the native window
        await openDisplayWindow(
          screen.id,
          'native',
          screen.isFullscreen,
          screen.name,
        )
        setOpenWindows((prev) => new Set(prev).add(screen.id))
        showToast(`Window "${screen.name}" opened`, 'success')
      }
    } catch {
      showToast('Failed to toggle window', 'error')
    }
  }

  const handleCopyUrl = async (screen: Screen) => {
    const url = `${getFrontendUrl()}/screen/${screen.id}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('URL copied to clipboard', 'success')
    } catch {
      showToast('Failed to copy URL', 'error')
    }
  }

  const handleOpenInNewTab = async (screen: Screen) => {
    const url = `${getFrontendUrl()}/screen/${screen.id}`
    await openInBrowser(url)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      // Close the window first if it's open
      await closeDisplayWindow(deleteConfirm.id)

      // Remove from local open windows state
      setOpenWindows((prev) => {
        const next = new Set(prev)
        next.delete(deleteConfirm.id)
        return next
      })

      await deleteScreen.mutateAsync(deleteConfirm.id)
      setDeleteConfirm(null)
      showToast('Screen deleted successfully', 'success')
    } catch {
      showToast('Failed to delete screen', 'error')
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
            Screens
          </h1>
        </div>
        <Button onClick={handleAddNew} variant="primary">
          <Plus size={20} className="mr-2" />
          Add Screen
        </Button>
      </div>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-400">
        Configure screens for different display purposes. Each screen type has
        its own layout and configuration options.
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
                    openWindows.has(screen.id) ? 'bg-green-500' : 'bg-gray-400'
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
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400 hidden md:inline">
                    {openWindows.has(screen.id) ? 'Open' : 'Closed'}
                  </span>
                  <Switch
                    checked={openWindows.has(screen.id)}
                    onCheckedChange={() => handleToggleWindow(screen)}
                  />
                </div>
                <div className="hidden md:block h-6 w-px bg-gray-200 dark:bg-gray-700" />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenInNewTab(screen)}
                    title="Open in new tab"
                  >
                    <ExternalLink size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyUrl(screen)}
                    title="Copy URL to clipboard"
                  >
                    <Copy size={16} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEdit(screen)}
                    title="Edit screen"
                  >
                    <Edit size={16} />
                    <span className="hidden md:inline ml-1">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(screen)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete screen"
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
            No screens configured
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Add your first screen to configure how content is displayed.
          </p>
          <Button onClick={handleAddNew} variant="primary">
            <Plus size={20} className="mr-2" />
            Add First Screen
          </Button>
        </div>
      )}

      {/* Add Screen Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Add New Screen
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Screen Name
                </label>
                <input
                  type="text"
                  value={newScreenName}
                  onChange={(e) => setNewScreenName(e.target.value)}
                  placeholder="e.g., Main Projector"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Screen Type
                </label>
                <Combobox
                  value={newScreenType}
                  onChange={(value) => setNewScreenType(value as ScreenType)}
                  options={SCREEN_TYPE_OPTIONS}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateScreen}
                disabled={!newScreenName.trim() || upsertScreen.isPending}
              >
                {upsertScreen.isPending && (
                  <Loader2 size={16} className="animate-spin mr-2" />
                )}
                Create & Configure
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
              Delete Screen?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete "{deleteConfirm.name}"? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                disabled={deleteScreen.isPending}
              >
                {deleteScreen.isPending && (
                  <Loader2 size={16} className="animate-spin mr-2" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

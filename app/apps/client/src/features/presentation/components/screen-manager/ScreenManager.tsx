import { Loader2, MonitorUp, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ScreenLinkModal } from '~/features/screen-links'
import { useSlideTemplate } from '~/features/slide-templates/hooks/useSlideTemplates'
import { templateDisplayName } from '~/features/slide-templates/utils/templateDisplayName'
import { Button } from '~/ui/button/Button'
import { Combobox } from '~/ui/combobox/Combobox'
import { PageHeader } from '~/ui/page'
import { useToast } from '~/ui/toast/useToast'
import { ScreenCard } from './ScreenCard'
import { ScreenExportModal } from './ScreenExportModal'
import { ScreenTabs } from './ScreenTabs'
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

export interface ScreenManagerProps {
  /** The screen whose settings show; the first one when not given. */
  selectedId?: number
  onSelect: (screenId: number) => void
}

/**
 * Settings → Screens: a tab per screen, and the chosen screen's settings.
 */
export function ScreenManager({ selectedId, onSelect }: ScreenManagerProps) {
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
  const selected =
    screens?.find((screen) => screen.id === selectedId) ?? screens?.[0]
  const upsertScreen = useUpsertScreen()
  const deleteScreen = useDeleteScreen()
  const duplicateScreen = useDuplicateScreen()
  const batchUpdateConfig = useBatchUpdateScreenConfig()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newScreenName, setNewScreenName] = useState('')
  const [newScreenType, setNewScreenType] = useState<ScreenType>('primary')
  const [editingScreenId, setEditingScreenId] = useState<number | null>(null)
  // The slide the editor opens on (a slide picked from the screen's theme)
  const [editingContentType, setEditingContentType] = useState<
    ContentType | undefined
  >()
  const [deleteConfirm, setDeleteConfirm] = useState<Screen | null>(null)
  const [exportScreen, setExportScreen] = useState<Screen | null>(null)
  const [linkScreen, setLinkScreen] = useState<Screen | null>(null)

  // Fetch full screen config when editing
  const { data: editingScreen } = useScreen(editingScreenId)
  const { data: editingTemplate } = useSlideTemplate(editingScreen?.templateId)

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
        onSelect(screen.id)
        setEditingScreenId(screen.id)
      }
      showToast(t('settings:sections.screens.toast.created'), 'success')
    } catch {
      showToast(t('settings:sections.screens.toast.createError'), 'error')
    }
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
      onSelect(copy.id)
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
        <Loader2
          size={24}
          strokeWidth={1.5}
          className="animate-spin text-fg-hint"
        />
      </div>
    )
  }

  // Full-screen editor mode
  if (editingScreenId && editingScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-app">
        <ScreenEditor
          screen={editingScreen}
          initialContentType={editingContentType}
          title={
            editingTemplate
              ? templateDisplayName(editingTemplate, t)
              : editingScreen.name
          }
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
          <Button
            onClick={handleAddNew}
            variant="primary"
            size="sm"
            className="gap-2"
          >
            <Plus size={16} strokeWidth={1.5} />
            {t('settings:sections.screens.addScreen')}
          </Button>
        }
      />

      {/* Screens List */}
      {screens && selected ? (
        <div className="space-y-3">
          <ScreenTabs
            screens={screens}
            selectedId={selected.id}
            onSelect={onSelect}
          />
          <ScreenCard
            key={selected.id}
            screen={selected}
            onEdit={(contentType) => {
              setEditingContentType(contentType)
              setEditingScreenId(selected.id)
            }}
            onExport={() => setExportScreen(selected)}
            onCopyUrl={() => handleCopyUrl(selected)}
            onShowElsewhere={() => setLinkScreen(selected)}
            onDuplicate={() => handleDuplicate(selected)}
            onDelete={() => handleDelete(selected)}
            isDuplicating={duplicateScreen.isPending}
            isShownInPreviews={selected.id === previewScreenId}
          />
        </div>
      ) : (
        <div className="text-center py-12 bg-panel rounded-xl border border-line">
          <MonitorUp
            size={32}
            strokeWidth={1.25}
            className="mx-auto text-fg-hint mb-4"
          />
          <h3 className="text-base font-semibold text-fg mb-2">
            {t('settings:sections.screens.noScreens')}
          </h3>
          <p className="text-sm text-fg-hint mb-4">
            {t('presentation:screens.noScreensDescription')}
          </p>
          <Button onClick={handleAddNew} variant="primary">
            <Plus size={16} strokeWidth={1.5} className="mr-2" />
            {t('presentation:screens.addFirstScreen')}
          </Button>
        </div>
      )}

      {/* Add Screen Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-panel rounded-xl border border-line shadow-popover w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-fg mb-4">
              {t('settings:sections.screens.addScreen')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg-label mb-1">
                  {t('presentation:screens.screenName')}
                </label>
                <input
                  type="text"
                  value={newScreenName}
                  onChange={(e) => setNewScreenName(e.target.value)}
                  placeholder={t('presentation:screens.screenNamePlaceholder')}
                  className="w-full h-9 px-3 text-sm rounded-[10px] bg-field text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-label mb-1">
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
                  <Loader2
                    size={16}
                    strokeWidth={1.5}
                    className="animate-spin mr-2"
                  />
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
          <div className="bg-panel rounded-xl border border-line shadow-popover w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-fg mb-2">
              {t('presentation:screens.deleteConfirmTitle')}
            </h3>
            <p className="text-sm text-fg-label mb-4">
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
                  <Loader2
                    size={16}
                    strokeWidth={1.5}
                    className="animate-spin mr-2"
                  />
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

      {linkScreen && (
        <ScreenLinkModal
          screenId={linkScreen.id}
          screenName={linkScreen.name}
          onClose={() => setLinkScreen(null)}
        />
      )}
    </div>
  )
}

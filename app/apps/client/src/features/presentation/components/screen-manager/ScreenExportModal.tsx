import {
  Check,
  ExternalLink,
  FileCode,
  FolderOpen,
  Loader2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getServerPort } from '~/config'
import { Button } from '~/ui/button/Button'
import { Combobox, type ComboboxOption } from '~/ui/combobox'
import { Input } from '~/ui/input/Input'
import {
  getExternalInterfaces,
  type NetworkInterface,
} from '../../../users/service'
import { useOBSExport } from '../../hooks/useOBSExport'
import type { ExportMode } from '../../service/obs-export'
import type { Screen } from '../../types'
import { getFrontendUrl, openInBrowser } from '../../utils/openDisplayWindow'

const LOCALHOST_VALUE = '__localhost__'
const CUSTOM_VALUE = '__custom__'

interface ScreenExportModalProps {
  isOpen: boolean
  onClose: () => void
  screen: Screen
}

export function ScreenExportModal({
  isOpen,
  onClose,
  screen,
}: ScreenExportModalProps) {
  const { t } = useTranslation('settings')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const [selectedMode, setSelectedMode] = useState<ExportMode>('staticFile')

  // Server URL selection state
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [selectedUrlOption, setSelectedUrlOption] =
    useState<string>(LOCALHOST_VALUE)
  const [customUrl, setCustomUrl] = useState('')

  // Build dropdown options: localhost + interfaces + custom
  const urlOptions: ComboboxOption[] = useMemo(() => {
    const options: ComboboxOption[] = [
      {
        value: LOCALHOST_VALUE,
        label: `${t('sections.screens.export.serverUrl.localhost')} (localhost:${getServerPort()})`,
      },
    ]

    // Add network interfaces
    for (const iface of interfaces) {
      options.push({
        value: iface.address,
        label: `${iface.name} - ${iface.address}:${getServerPort()}`,
      })
    }

    // Add custom option
    options.push({
      value: CUSTOM_VALUE,
      label: t('sections.screens.export.serverUrl.custom'),
    })

    return options
  }, [interfaces, t])

  // Compute the actual server URL based on selection
  const serverUrl = useMemo(() => {
    if (selectedUrlOption === LOCALHOST_VALUE) {
      return `http://localhost:${getServerPort()}`
    }
    if (selectedUrlOption === CUSTOM_VALUE) {
      return customUrl || `http://localhost:${getServerPort()}`
    }
    // It's a network interface IP
    return `http://${selectedUrlOption}:${getServerPort()}`
  }, [selectedUrlOption, customUrl])

  const { exportToFile, isExporting, progress, error, filePath, retry } =
    useOBSExport({
      screenId: screen.id,
      screenName: screen.name,
      serverUrl,
    })

  // Fetch interfaces when modal opens
  useEffect(() => {
    if (isOpen) {
      getExternalInterfaces()
        .then((ifaces) => {
          setInterfaces(ifaces)
        })
        .catch(() => {
          setInterfaces([])
        })
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
      // Reset state when opening
      setSelectedMode('staticFile')
      setSelectedUrlOption(LOCALHOST_VALUE)
      setCustomUrl('')
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onClose()
    }
  }

  const handleExport = async () => {
    if (selectedMode === 'url') {
      const url = `${getFrontendUrl()}/screen/${screen.id}`
      await openInBrowser(url)
      onClose()
    } else {
      await exportToFile()
    }
  }

  const handleOpenFolder = async () => {
    if (!filePath) return

    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      await revealItemInDir(filePath)
    } catch {
      // Fallback: just close the modal
    }
  }

  const isSuccess = progress === 'success'
  const isError = progress === 'error'

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-xl border border-line shadow-popover backdrop:bg-black/50 bg-panel max-w-md w-full"
      onClose={onClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6 relative">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex items-center justify-center h-8 w-8 rounded-lg text-fg-label hover:bg-hover hover:text-fg"
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        {/* Header */}
        <div className="mb-4 pr-8">
          <h2 className="text-base font-semibold text-fg">
            {t('sections.screens.export.title')}
          </h2>
          <span className="inline-block mt-1 text-xs text-fg-hint">
            {t('sections.screens.export.options.staticFile.recommended')}
          </span>
        </div>

        {/* Description */}
        <p className="text-[13px] text-fg-label mb-6">
          {t('sections.screens.export.description')}
        </p>

        {/* Options */}
        {!isSuccess && (
          <div className="space-y-3 mb-6">
            {/* URL Option */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedMode === 'url'
                  ? 'border-transparent bg-selected'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              <input
                type="radio"
                name="exportMode"
                value="url"
                checked={selectedMode === 'url'}
                onChange={() => setSelectedMode('url')}
                className="mt-1 accent-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <ExternalLink
                    size={16}
                    strokeWidth={1.5}
                    className="text-fg-label"
                  />
                  <span className="text-[13px] font-medium text-fg">
                    {t('sections.screens.export.options.url.title')}
                  </span>
                </div>
                <p className="text-xs text-fg-hint mt-1">
                  {t('sections.screens.export.options.url.description')}
                </p>
              </div>
            </label>

            {/* Static File Option */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedMode === 'staticFile'
                  ? 'border-transparent bg-selected'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              <input
                type="radio"
                name="exportMode"
                value="staticFile"
                checked={selectedMode === 'staticFile'}
                onChange={() => setSelectedMode('staticFile')}
                className="mt-1 accent-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileCode
                    size={16}
                    strokeWidth={1.5}
                    className="text-fg-label"
                  />
                  <span className="text-[13px] font-medium text-fg">
                    {t('sections.screens.export.options.staticFile.title')}
                  </span>
                </div>
                <p className="text-xs text-fg-hint mt-1">
                  {t('sections.screens.export.options.staticFile.description')}
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Server URL Selection - only show for static file mode */}
        {!isSuccess && selectedMode === 'staticFile' && (
          <div className="mb-6">
            <label className="block text-[13px] font-medium text-fg-label mb-2">
              {t('sections.screens.export.serverUrl.label')}
            </label>

            <Combobox
              options={urlOptions}
              value={selectedUrlOption}
              onChange={(val) => setSelectedUrlOption(val as string)}
              allowClear={false}
              portalContainer={dialogRef.current}
            />

            {/* Custom URL input - show when custom option selected */}
            {selectedUrlOption === CUSTOM_VALUE && (
              <div className="mt-2">
                <Input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="http://192.168.1.100:3000"
                  className="text-sm"
                />
              </div>
            )}

            {/* Show the resulting URL */}
            <p className="mt-2 text-xs text-fg-hint">
              {t('sections.screens.export.serverUrl.result')}:{' '}
              <code className="bg-field px-1 rounded">{serverUrl}</code>
            </p>
          </div>
        )}

        {/* Note about OBS */}
        {!isSuccess && selectedMode === 'staticFile' && (
          <div className="bg-field rounded-lg p-3 mb-6">
            <p className="text-[13px] text-fg-body">
              {t('sections.screens.export.note')}
            </p>
          </div>
        )}

        {/* Success State */}
        {isSuccess && filePath && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-fg mb-3">
              <Check size={16} strokeWidth={1.5} className="text-ok" />
              <span className="font-medium">
                {t('sections.screens.export.success')}
              </span>
            </div>
            <div className="bg-field rounded-lg p-3">
              <p className="text-xs text-fg-hint mb-1">
                {t('sections.screens.export.filePath', { path: '' })}
              </p>
              <code className="text-[13px] font-mono text-fg break-all">
                {filePath}
              </code>
            </div>
          </div>
        )}

        {/* Error State */}
        {isError && error && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-6">
            <p className="text-[13px] text-red-800 dark:text-red-200">
              {error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-line">
          {isSuccess ? (
            <>
              <Button variant="secondary" onClick={handleOpenFolder}>
                <FolderOpen size={16} strokeWidth={1.5} className="mr-2" />
                {t('sections.screens.export.openFolder')}
              </Button>
              <Button onClick={onClose}>{t('common:buttons.done')}</Button>
            </>
          ) : isError ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                {t('sections.screens.export.cancel')}
              </Button>
              <Button onClick={retry}>
                {t('sections.screens.export.retry')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={isExporting}>
                {t('sections.screens.export.cancel')}
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting && (
                  <Loader2
                    size={16}
                    strokeWidth={1.5}
                    className="mr-2 animate-spin"
                  />
                )}
                {isExporting
                  ? t('sections.screens.export.generating')
                  : selectedMode === 'url'
                    ? t('sections.screens.export.options.url.title')
                    : t('sections.screens.export.export')}
              </Button>
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}

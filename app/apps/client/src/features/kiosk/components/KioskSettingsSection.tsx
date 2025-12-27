import { Bug, Monitor, PlayCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useScreens } from '~/features/presentation'
import { Button } from '~/ui/button'
import { Combobox } from '~/ui/combobox'
import { Switch } from '~/ui/switch/Switch'
import { useToast } from '~/ui/toast/useToast'
import { KioskScreenDimOverlay } from './KioskScreenDimOverlay'
import {
  useKioskSettings,
  useUpdateKioskSettings,
} from '../hooks/useKioskSettings'
import type { KioskStartupPage } from '../types'
import { KIOSK_ROUTE_OPTIONS } from '../types'

export function KioskSettingsSection() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [showDebugOverlay, setShowDebugOverlay] = useState(false)

  const { data: settings, isLoading } = useKioskSettings()
  const updateSettings = useUpdateKioskSettings()
  const { data: screens } = useScreens()

  // Get all available screens for selection
  const availableScreens = screens ?? []

  const handleEnabledChange = async (enabled: boolean) => {
    try {
      await updateSettings.mutateAsync({ enabled })
      showToast(t('sections.kiosk.toast.saved'), 'success')
    } catch {
      showToast(t('sections.kiosk.toast.error'), 'error')
    }
  }

  const handleStartupPageChange = async (value: string | number | null) => {
    if (!value || typeof value === 'number') return

    try {
      let startupPage: KioskStartupPage

      if (value.startsWith('screen:')) {
        const screenId = parseInt(value.replace('screen:', ''), 10)
        startupPage = { type: 'screen', screenId }
      } else {
        startupPage = { type: 'route', path: value }
      }

      await updateSettings.mutateAsync({ startupPage })
      showToast(t('sections.kiosk.toast.saved'), 'success')
    } catch {
      showToast(t('sections.kiosk.toast.error'), 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse h-32 bg-gray-200 dark:bg-gray-700 rounded" />
    )
  }

  // Build startup page options
  const startupOptions = [
    ...KIOSK_ROUTE_OPTIONS.map((r) => ({
      value: r.value,
      label: t(`sections.kiosk.routes.${r.labelKey}`),
    })),
    ...availableScreens.map((s) => ({
      value: `screen:${s.id}`,
      label: `${t('sections.kiosk.screenPrefix')}: ${s.name}`,
    })),
  ]

  const currentStartupValue =
    settings?.startupPage.type === 'screen'
      ? `screen:${settings.startupPage.screenId}`
      : (settings?.startupPage.path ?? '/present')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Monitor size={24} className="text-orange-600" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('sections.kiosk.title')}
        </h3>
      </div>

      <p className="text-gray-600 dark:text-gray-400 text-sm">
        {t('sections.kiosk.description')}
      </p>

      {/* Enable/Disable Kiosk Mode */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div>
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            {t('sections.kiosk.enable.label')}
          </label>
          <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
            {t('sections.kiosk.enable.description')}
          </p>
        </div>
        <Switch
          checked={settings?.enabled ?? false}
          onCheckedChange={handleEnabledChange}
          disabled={updateSettings.isPending}
        />
      </div>

      {/* Startup Page Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            {t('sections.kiosk.startupPage.label')}
          </label>
        </div>
        <Combobox
          options={startupOptions}
          value={currentStartupValue}
          onChange={handleStartupPageChange}
          disabled={!settings?.enabled || updateSettings.isPending}
          allowClear={false}
        />
        <p className="text-gray-600 dark:text-gray-400 text-xs">
          {t('sections.kiosk.startupPage.description')}
        </p>
      </div>

      {/* Debug: Test Screen Dim Overlay */}
      {import.meta.env.DEV && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Bug className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-600">
              Debug Tools
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebugOverlay(true)}
          >
            Test Screen Dim Overlay
          </Button>
          <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">
            Tap anywhere on the overlay to dismiss it
          </p>
        </div>
      )}

      {/* Debug Overlay */}
      {showDebugOverlay && (
        <KioskScreenDimOverlay onDismiss={() => setShowDebugOverlay(false)} />
      )}
    </div>
  )
}

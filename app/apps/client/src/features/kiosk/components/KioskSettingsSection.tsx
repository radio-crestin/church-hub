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
import {
  dimScreen,
  isBrightnessControlSupported,
  restoreBrightness,
  setBrightness,
} from '../service/brightnessService'
import type { KioskStartupPage } from '../types'
import { KIOSK_ROUTE_OPTIONS } from '../types'

interface KioskSettingsSectionProps {
  portalContainer?: HTMLElement | null
}

export function KioskSettingsSection({
  portalContainer,
}: KioskSettingsSectionProps) {
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
    return <div className="h-32 bg-field rounded-xl" />
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
        <Monitor size={16} strokeWidth={1.5} className="text-fg-label" />
        <h3 className="text-base font-semibold text-fg">
          {t('sections.kiosk.title')}
        </h3>
      </div>

      <p className="text-fg-label text-[13px]">
        {t('sections.kiosk.description')}
      </p>

      {/* Enable/Disable Kiosk Mode */}
      <div className="flex items-center justify-between p-4 bg-panel border border-line rounded-xl">
        <div>
          <label className="text-[13px] font-medium text-fg">
            {t('sections.kiosk.enable.label')}
          </label>
          <p className="text-fg-hint text-xs mt-1">
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
          <PlayCircle size={16} strokeWidth={1.5} className="text-fg-label" />
          <label className="text-[13px] font-medium text-fg">
            {t('sections.kiosk.startupPage.label')}
          </label>
        </div>
        <Combobox
          options={startupOptions}
          value={currentStartupValue}
          onChange={handleStartupPageChange}
          disabled={!settings?.enabled || updateSettings.isPending}
          allowClear={false}
          portalContainer={portalContainer}
        />
        <p className="text-fg-hint text-xs">
          {t('sections.kiosk.startupPage.description')}
        </p>
      </div>

      {/* Debug: Test Screen Dim Overlay - Always show for testing */}
      <div className="pt-4 border-t border-line">
        <div className="flex items-center gap-2 mb-3">
          <Bug size={16} strokeWidth={1.5} className="text-fg-label" />
          <span className="text-[13px] font-medium text-fg-label">
            {t('sections.kiosk.debug.title')}
          </span>
        </div>

        <div className="space-y-3">
          {/* Overlay Test */}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebugOverlay(true)}
            >
              {t('sections.kiosk.debug.testOverlay')}
            </Button>
            <p className="text-fg-hint text-xs mt-1">
              {t('sections.kiosk.debug.tapToDismiss')}
            </p>
          </div>

          {/* Brightness Controls */}
          <div className="space-y-2">
            <p className="text-fg-hint text-xs">
              {t('sections.kiosk.debug.brightnessControl')}{' '}
              {isBrightnessControlSupported()
                ? t('sections.kiosk.debug.supported')
                : t('sections.kiosk.debug.notSupported')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBrightness(0)}
              >
                0%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBrightness(0.25)}
              >
                25%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBrightness(0.5)}
              >
                50%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBrightness(1)}
              >
                100%
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => dimScreen()}>
                {t('sections.kiosk.debug.dimScreen')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => restoreBrightness()}
              >
                {t('sections.kiosk.debug.restoreBrightness')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Overlay */}
      {showDebugOverlay && (
        <KioskScreenDimOverlay onDismiss={() => setShowDebugOverlay(false)} />
      )}
    </div>
  )
}

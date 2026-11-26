import { PlugZap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'
import { Button } from '~/ui/button/Button'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useOBSConfig, useOBSConnection } from '../../hooks'

/** Whether Church Hub talks to OBS now, and whether it connects at start. */
export function OBSConnectionSection() {
  const { t } = useTranslation('livestream')
  const { isConnected, isConnecting, isDisconnecting, connect, disconnect } =
    useOBSConnection()
  const { config, update } = useOBSConfig()

  return (
    <SettingsSection
      title={t('obsSettings.connection.title')}
      description={t('obsSettings.connection.description')}
      icon={PlugZap}
      testId="obs-settings-connection"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 py-2">
        <p className="text-sm text-fg-body">
          {isConnected
            ? t('obs.connected')
            : isConnecting
              ? t('obs.connecting')
              : t('obs.disconnected')}
        </p>
        {isConnected ? (
          <Button
            variant="secondary"
            onClick={() => disconnect()}
            disabled={isDisconnecting}
          >
            {t('obs.disconnect')}
          </Button>
        ) : (
          <Button onClick={() => connect()} disabled={isConnecting}>
            {t('obs.connect')}
          </Button>
        )}
      </div>
      {config && (
        <SwitchRow
          label={t('obs.autoConnect')}
          description={t('obsSettings.connection.autoConnectHint')}
          checked={config.autoConnect}
          onCheckedChange={(autoConnect) => update({ ...config, autoConnect })}
          testId="obs-auto-connect"
        />
      )}
    </SettingsSection>
  )
}

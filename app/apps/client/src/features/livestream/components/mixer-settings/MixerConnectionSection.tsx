import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'
import { Button } from '~/ui/button/Button'
import { Input } from '~/ui/input'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useMixerConfig, useMixerConnectionStatus } from '../../hooks'
import { SettingField } from '../settings-page/SettingField'
import { SettingFieldRow } from '../settings-page/SettingFieldRow'

/** Whether Church Hub controls the mixer, and where it is on the network. */
export function MixerConnectionSection() {
  const { t } = useTranslation('livestream')
  const { config, update, isUpdating, testConnection, isTesting } =
    useMixerConfig()
  const { isConnected } = useMixerConnectionStatus()
  const [host, setHost] = useState('')
  const [port, setPort] = useState(10024)
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>(
    'idle',
  )

  useEffect(() => {
    if (!config) return
    setHost(config.host)
    setPort(config.port)
  }, [config])

  if (!config) return null
  const isDirty = host !== config.host || port !== config.port

  const handleTest = async () => {
    setTestStatus('idle')
    const result = await testConnection().catch(() => ({ success: false }))
    setTestStatus(result.success ? 'success' : 'error')
  }

  return (
    <SettingsSection
      title={t('mixerSettings.connection.title')}
      description={t('mixer.setup.description')}
      icon={SlidersHorizontal}
      testId="mixer-settings-connection"
    >
      <SwitchRow
        label={t('mixer.setup.enableControl')}
        description={
          config.isEnabled
            ? isConnected
              ? t('mixer.connected')
              : t('mixerSettings.connection.notAnswering')
            : t('mixerSettings.connection.enableHint')
        }
        checked={config.isEnabled}
        onCheckedChange={(isEnabled) => update({ ...config, isEnabled })}
        testId="mixer-enabled"
      />
      <SettingFieldRow>
        <SettingField
          label={t('mixer.setup.host')}
          description={t('mixer.setup.supportedMixers')}
        >
          {(id) => (
            <Input
              id={id}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.0.50"
            />
          )}
        </SettingField>
        <SettingField
          label={t('mixer.setup.port')}
          description={t('mixerSettings.connection.portHint')}
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              value={port}
              onChange={(e) =>
                setPort(Number.parseInt(e.target.value, 10) || 10024)
              }
            />
          )}
        </SettingField>
      </SettingFieldRow>
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        {testStatus === 'success' && (
          <span className="text-sm text-green-600 dark:text-green-400">
            {t('mixer.setup.testSuccess')}
          </span>
        )}
        {testStatus === 'error' && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {t('mixer.setup.testFailed')}
          </span>
        )}
        <Button
          variant="secondary"
          onClick={handleTest}
          disabled={isTesting || !config.host}
        >
          {isTesting
            ? t('mixer.setup.testing')
            : t('mixer.setup.testConnection')}
        </Button>
        <Button
          onClick={() => update({ ...config, host, port })}
          disabled={!isDirty || isUpdating}
        >
          {t('mixer.setup.save')}
        </Button>
      </div>
    </SettingsSection>
  )
}

import { KeyRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'
import { Button } from '~/ui/button/Button'
import { Input } from '~/ui/input'
import { useOBSConfig } from '../../hooks'
import { generateSecurePassword } from '../../utils'
import { SettingField } from '../settings-page/SettingField'
import { SettingFieldRow } from '../settings-page/SettingFieldRow'

/** Where OBS runs and the WebSocket password both sides use. */
export function OBSAccessSection() {
  const { t } = useTranslation('livestream')
  const { config, update, isUpdating } = useOBSConfig()
  const generatedPassword = useMemo(() => generateSecurePassword(), [])
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState(4455)
  const [copied, setCopied] = useState(false)
  const password = config?.password || generatedPassword

  useEffect(() => {
    if (!config) return
    setHost(config.host)
    setPort(config.port)
  }, [config])

  const isDirty =
    !!config &&
    (host !== config.host || port !== config.port || !config.password)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <SettingsSection
      title={t('obsSettings.access.title')}
      description={t('obsSettings.access.description')}
      icon={KeyRound}
      testId="obs-settings-access"
    >
      <SettingFieldRow>
        <SettingField
          label={t('obs.setup.addressTitle')}
          description={t('obs.setup.addressDescription')}
        >
          {(id) => (
            <Input
              id={id}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={t('obs.setup.addressPlaceholder')}
            />
          )}
        </SettingField>
        <SettingField
          label={t('obs.port')}
          description={t('obsSettings.access.portHint')}
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              value={port}
              onChange={(e) =>
                setPort(Number.parseInt(e.target.value, 10) || 4455)
              }
            />
          )}
        </SettingField>
      </SettingFieldRow>
      <SettingField
        label={t('obs.password')}
        description={t('obs.setup.step3Description')}
      >
        {() => (
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-gray-100 px-3 py-2 font-mono text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100">
              {password}
            </code>
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? t('obs.setup.copied') : t('obs.setup.copy')}
            </Button>
          </div>
        )}
      </SettingField>
      <div className="flex justify-end pt-2">
        <Button
          onClick={() =>
            update({
              host: host || 'localhost',
              port,
              password,
              autoConnect: config?.autoConnect ?? true,
            })
          }
          disabled={!isDirty || isUpdating}
        >
          {t('obsSettings.access.save')}
        </Button>
      </div>
    </SettingsSection>
  )
}

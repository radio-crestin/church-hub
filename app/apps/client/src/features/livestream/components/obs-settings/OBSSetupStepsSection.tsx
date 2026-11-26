import { ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'

/** What to turn on in OBS once, so Church Hub can control it. */
export function OBSSetupStepsSection() {
  const { t } = useTranslation('livestream')

  return (
    <SettingsSection
      title={t('obsSettings.steps.title')}
      description={t('obs.setup.step1Description')}
      icon={ListChecks}
      testId="obs-settings-steps"
    >
      <a
        href="https://github.com/obsproject/obs-websocket/releases"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-focus hover:underline"
      >
        {t('obs.setup.downloadLink')}
      </a>
      <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-fg-body">
        <li>{t('obs.setup.step2Instruction1')}</li>
        <li>{t('obs.setup.step2Instruction2')}</li>
        <li>{t('obs.setup.step2Instruction3')}</li>
      </ol>
      <p className="mt-3 rounded-lg bg-field p-3 text-sm text-fg-label">
        {t('obs.setup.noteDescription')}
      </p>
    </SettingsSection>
  )
}

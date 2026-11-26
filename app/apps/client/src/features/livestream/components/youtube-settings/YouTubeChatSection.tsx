import { ExternalLink, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'
import { Button } from '~/ui/button/Button'
import { openExternalUrl } from '../../utils'

const STUDIO_LIVE_URL = 'https://studio.youtube.com/channel/UC/livestreaming'

/**
 * Live chat and comments: YouTube's API can't set who may write, so this
 * says where the operator sets it in YouTube Studio.
 */
export function YouTubeChatSection() {
  const { t } = useTranslation('livestream')

  return (
    <SettingsSection
      title={t('youtubeSettings.chat.title')}
      description={t('youtubeSettings.chat.description')}
      icon={MessageSquare}
      testId="youtube-settings-chat"
    >
      <div className="rounded-lg bg-field p-3 text-[13px] text-fg-body">
        <p className="font-medium">{t('youtubeSettings.chat.notByApi')}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>{t('youtubeSettings.chat.stepChat')}</li>
          <li>{t('youtubeSettings.chat.stepComments')}</li>
        </ol>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="mt-3 gap-2"
        onClick={() => openExternalUrl(STUDIO_LIVE_URL)}
      >
        <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
        {t('youtubeSettings.chat.openStudio')}
      </Button>
    </SettingsSection>
  )
}

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
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
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
        <ExternalLink className="h-4 w-4" aria-hidden />
        {t('youtubeSettings.chat.openStudio')}
      </Button>
    </SettingsSection>
  )
}

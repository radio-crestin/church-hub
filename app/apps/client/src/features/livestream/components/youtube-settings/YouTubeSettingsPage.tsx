import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import { useToast } from '~/ui/toast'
import { useYouTubeSettingsForm } from './useYouTubeSettingsForm'
import { YouTubeAccountSection } from './YouTubeAccountSection'
import { YouTubeAudienceSection } from './YouTubeAudienceSection'
import { YouTubeChatSection } from './YouTubeChatSection'
import { YouTubeDetailsSection } from './YouTubeDetailsSection'
import { YouTubeExtrasSection } from './YouTubeExtrasSection'
import { YouTubeStreamSection } from './YouTubeStreamSection'
import { YouTubeTemplateSection } from './YouTubeTemplateSection'
import { usePastBroadcasts, useYouTubeAuth } from '../../hooks'
import { SettingsPageLayout } from '../settings-page/SettingsPageLayout'

/** Every setting a new YouTube broadcast is created with, on one page. */
export function YouTubeSettingsPage() {
  const { t } = useTranslation('livestream')
  const { showToast } = useToast()
  const { isAuthenticated } = useYouTubeAuth()
  const { broadcasts } = usePastBroadcasts(isAuthenticated)
  const form = useYouTubeSettingsForm()
  const [filledFromLatest, setFilledFromLatest] = useState(false)
  const { draft, applyTemplate } = form

  // Never set up yet: start from the latest stream.
  const latestId = broadcasts[0]?.broadcastId
  const needsTemplate = !!draft && !draft.selectedBroadcastId
  useEffect(() => {
    if (!needsTemplate || !latestId) return
    applyTemplate(latestId).then(() => setFilledFromLatest(true))
  }, [needsTemplate, latestId, applyTemplate])

  const handleSave = async () => {
    await form.save()
    setFilledFromLatest(false)
    showToast(t('youtubeSettings.saved'), 'success')
  }

  return (
    <SettingsPageLayout
      title={t('youtubeSettings.title')}
      description={t('youtubeSettings.subtitle')}
      testId="youtube-settings-page"
      footer={
        isAuthenticated && (
          <>
            {form.isDirty && (
              <span className="text-sm text-amber-700 dark:text-amber-300">
                {t('youtubeSettings.unsaved')}
              </span>
            )}
            <Button
              data-testid="youtube-settings-save"
              onClick={handleSave}
              disabled={!form.isDirty || form.isSaving}
            >
              {t('youtubeSettings.save')}
            </Button>
          </>
        )
      }
    >
      <YouTubeAccountSection />
      {isAuthenticated && draft && (
        <>
          <YouTubeTemplateSection
            selectedBroadcastId={draft.selectedBroadcastId}
            onPick={(id) => {
              setFilledFromLatest(false)
              applyTemplate(id)
            }}
            isApplying={form.isApplyingTemplate}
            filledFromLatest={filledFromLatest}
          />
          <YouTubeDetailsSection draft={draft} set={form.set} />
          <YouTubeAudienceSection draft={draft} set={form.set} />
          <YouTubeStreamSection draft={draft} set={form.set} />
          <YouTubeExtrasSection draft={draft} set={form.set} />
          <YouTubeChatSection />
        </>
      )}
    </SettingsPageLayout>
  )
}

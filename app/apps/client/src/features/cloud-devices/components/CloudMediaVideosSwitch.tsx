import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useToast } from '~/ui/toast'
import { useCloudMediaVideos } from '../hooks/useCloudMediaVideos'

/**
 * Settings > Phones: joined phones show the church's pictures with this
 * computer off; its background videos too, when this is on.
 */
export function CloudMediaVideosSwitch() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const { hasPermission } = usePermissions()
  const { enabled, set } = useCloudMediaVideos()

  return (
    <SwitchRow
      label={t('sections.cloudDevices.mediaVideos')}
      description={t('sections.cloudDevices.mediaVideosDescription')}
      checked={enabled}
      disabled={set.isPending || !hasPermission('settings.edit')}
      onCheckedChange={(on) =>
        set.mutate(on, {
          onError: (error) => showToast(error.message, 'error'),
        })
      }
      testId="cloud-media-videos"
    />
  )
}

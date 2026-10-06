import { useTranslation } from 'react-i18next'

import { PermissionGate } from '~/ui/PermissionGate'
import { LinkSourcesSection } from './LinkSourcesSection'
import { PublicationsSection } from './PublicationsSection'
import { S3StorageSection } from './S3StorageSection'
import { SongFileExportSection } from './SongFileExportSection'

/**
 * Settings card for song sources: sources from links, exporting a category
 * as a `.chsongs` file, and sharing categories through the user's S3 bucket.
 */
export function SongSourcesSettings() {
  const { t } = useTranslation('songDiscovery')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('songSources.title')}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('songSources.description')}
        </p>
      </div>
      <PermissionGate permission="songs.create">
        <LinkSourcesSection />
      </PermissionGate>
      <SongFileExportSection />
      <PermissionGate permission="settings.edit">
        <S3StorageSection />
        <PublicationsSection />
      </PermissionGate>
    </div>
  )
}

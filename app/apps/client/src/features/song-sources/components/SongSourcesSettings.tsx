import { useTranslation } from 'react-i18next'

import { isWebApp } from '~/config'
import { PermissionGate } from '~/ui/PermissionGate'
import { LinkSourcesSection } from './LinkSourcesSection'
import { PublicationsSection } from './PublicationsSection'
import { S3StorageSection } from './S3StorageSection'
import { ShareMySongsSection } from './ShareMySongsSection'
import { SongFileExportSection } from './SongFileExportSection'

/**
 * Settings card for song sources: sources from links, exporting a category
 * as a `.chsongs` file, sharing the songs through Church Hub's cloud sync,
 * and sharing categories through the user's own S3 bucket. The web app
 * keeps only the export: the sources, the share and the bucket are the PC's.
 */
export function SongSourcesSettings() {
  const { t } = useTranslation('songDiscovery')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-fg">
          {t('songSources.title')}
        </h3>
        <p className="mt-1 text-sm text-fg-hint">
          {t('songSources.description')}
        </p>
      </div>
      {!isWebApp && (
        <PermissionGate permission="songs.create">
          <LinkSourcesSection />
        </PermissionGate>
      )}
      <SongFileExportSection />
      {!isWebApp && (
        <PermissionGate permission="settings.edit">
          <ShareMySongsSection />
          <S3StorageSection />
          <PublicationsSection />
        </PermissionGate>
      )}
    </div>
  )
}

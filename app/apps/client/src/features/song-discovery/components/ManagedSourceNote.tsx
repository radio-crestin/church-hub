import { useTranslation } from 'react-i18next'

import { useManagedRelease } from '../hooks/useManagedRelease'
import type { SongSource } from '../providers'

/** "Managed by Church Hub · version …" under a source Church Hub hosts. */
export function ManagedSourceNote({ source }: { source: SongSource }) {
  const { t } = useTranslation('songDiscovery')
  const { data: release } = useManagedRelease(source)

  return (
    <span
      data-testid={`managed-source-${source.id}`}
      className="block truncate text-xs text-fg-hint"
    >
      {release
        ? t('source.managedVersion', { version: release.version })
        : t('source.managed')}
    </span>
  )
}

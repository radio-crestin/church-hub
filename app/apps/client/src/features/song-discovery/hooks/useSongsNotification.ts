import { useNavigate } from '@tanstack/react-router'
import { Music } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { AppNotification } from '~/features/notifications/types'
import { usePermissions } from '~/provider/permissions-provider'
import { useSongUpdates } from './useSongUpdates'

/**
 * One notification for every song source: the songs the automatic update
 * added and the ones left to review, a line per source. It changes (and
 * shows again) only when a source changes.
 */
export function useSongsNotification(): AppNotification | null {
  const { t } = useTranslation('songDiscovery')
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const { state } = useSongUpdates()

  const sources = (state?.sources ?? []).filter(
    (s) => s.imported > 0 || s.newCount > 0,
  )
  if (!hasPermission('songs.create') || sources.length === 0) return null

  const added = sources.reduce((sum, s) => sum + s.imported, 0)
  const toReview = sources.reduce((sum, s) => sum + s.newCount, 0)
  const openDiscovery = (source?: string) =>
    navigate({ to: '/songs/discover', search: { source } })

  return {
    id: `songs:${sources.map((s) => `${s.sourceId}=${s.checksum}`).join('|')}`,
    icon: Music,
    title:
      added > 0
        ? t('notice.added', { count: added })
        : t('notice.title', { count: toReview }),
    description:
      added > 0 && toReview > 0
        ? t('notice.toReview', { count: toReview })
        : undefined,
    lines: sources.map((s) => ({
      key: s.sourceId,
      label: s.name,
      value: [
        s.imported > 0 ? t('notice.addedShort', { count: s.imported }) : '',
        s.newCount > 0 ? t('notice.newShort', { count: s.newCount }) : '',
      ]
        .filter(Boolean)
        .join(' · '),
      onClick: s.newCount > 0 ? () => openDiscovery(s.sourceId) : undefined,
    })),
    action:
      toReview > 0
        ? { label: t('notice.review'), onClick: () => openDiscovery() }
        : {
            label: t('notice.viewSongs'),
            onClick: () => navigate({ to: '/songs' }),
          },
    dismissible: true,
  }
}

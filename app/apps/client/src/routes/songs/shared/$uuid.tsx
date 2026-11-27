import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { findSharedSong } from '~/features/song-links'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/songs/shared/$uuid')({
  component: SharedSongRedirect,
})

/**
 * A song's link opened on a device of its church (T-177): the church's own
 * copy of the song, by its uuid; the songs list while it has not synced yet.
 */
function SharedSongRedirect() {
  const { uuid } = Route.useParams()
  const { t } = useTranslation('songLibrary')
  const found = useQuery({
    queryKey: ['song-links', 'by-uuid', uuid],
    queryFn: () => findSharedSong(uuid),
    retry: false,
  })
  if (found.data) {
    return (
      <Navigate
        to="/songs/$songId"
        params={{ songId: String(found.data.songId) }}
        replace
      />
    )
  }
  return (
    <PagePermissionGuard permission="songs.view">
      <p className="p-6 text-sm text-fg-hint">
        {found.isError ? t('link.notOnDevice') : t('link.opening')}
      </p>
    </PagePermissionGuard>
  )
}

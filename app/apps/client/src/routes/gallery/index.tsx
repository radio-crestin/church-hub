import { createFileRoute } from '@tanstack/react-router'

import { GalleryPage } from '~/features/gallery'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/gallery/')({
  component: GalleryRoute,
})

function GalleryRoute() {
  return (
    <PagePermissionGuard permission="displays.view">
      <GalleryPage />
    </PagePermissionGuard>
  )
}

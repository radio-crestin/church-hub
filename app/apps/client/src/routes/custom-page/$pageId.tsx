import { createFileRoute } from '@tanstack/react-router'

import { CustomPageView } from '~/features/sidebar-config'

export const Route = createFileRoute('/custom-page/$pageId')({
  component: CustomPageViewRoute,
})

function CustomPageViewRoute() {
  const { pageId } = Route.useParams()
  // Key ensures component is fully remounted when pageId changes
  return <CustomPageView key={pageId} pageId={pageId} />
}

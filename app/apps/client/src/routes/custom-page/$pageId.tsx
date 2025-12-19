import { createFileRoute } from '@tanstack/react-router'

import { CustomPageView } from '~/features/sidebar-config'

export const Route = createFileRoute('/custom-page/$pageId')({
  component: CustomPageViewRoute,
})

function CustomPageViewRoute() {
  const { pageId } = Route.useParams()
  // Webview manager handles page switching - no need to remount component
  return <CustomPageView pageId={pageId} />
}

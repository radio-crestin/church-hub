import { createFileRoute } from '@tanstack/react-router'

import { PresentationViewer } from '~/features/presentation/components'

export const Route = createFileRoute('/presentation/viewer')({
  component: PresentationViewerPage,
})

function PresentationViewerPage() {
  // Parse display ID from query params if provided
  const { displayId } = Route.useSearch() as { displayId?: string }
  const parsedDisplayId = displayId ? parseInt(displayId, 10) : undefined

  return (
    <div className="h-screen w-screen overflow-hidden">
      <PresentationViewer displayId={parsedDisplayId} />
    </div>
  )
}

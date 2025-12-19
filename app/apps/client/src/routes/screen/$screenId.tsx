import { createFileRoute } from '@tanstack/react-router'

import { ScreenRenderer } from '~/features/presentation'

export const Route = createFileRoute('/screen/$screenId')({
  component: ScreenPage,
})

function ScreenPage() {
  const { screenId } = Route.useParams()
  const id = Number.parseInt(screenId, 10)

  if (Number.isNaN(id) || id <= 0) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
        <p>Invalid screen ID</p>
      </div>
    )
  }

  return <ScreenRenderer screenId={id} />
}

import { createFileRoute } from '@tanstack/react-router'

import { DisplayWindow } from '~/features/presentation'

export const Route = createFileRoute('/display/$displayId')({
  component: DisplayWindowPage,
})

function DisplayWindowPage() {
  const { displayId } = Route.useParams()
  const id = Number.parseInt(displayId, 10)

  if (Number.isNaN(id) || id <= 0) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
        <p>Invalid display ID</p>
      </div>
    )
  }

  return <DisplayWindow displayId={id} />
}

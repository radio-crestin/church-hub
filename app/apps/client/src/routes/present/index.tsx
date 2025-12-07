import { createFileRoute } from '@tanstack/react-router'

import { ControlRoom } from '~/features/presentation'

export const Route = createFileRoute('/present/')({
  component: PresentPage,
})

function PresentPage() {
  return (
    <div className="h-full">
      <ControlRoom />
    </div>
  )
}

import { createFileRoute } from '@tanstack/react-router'

import { DisplayManager } from '~/features/presentation'

export const Route = createFileRoute('/displays/')({
  component: DisplaysPage,
})

function DisplaysPage() {
  return (
    <div className="p-6">
      <DisplayManager />
    </div>
  )
}

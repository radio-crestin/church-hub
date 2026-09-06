import { createFileRoute } from '@tanstack/react-router'

import { LiveTranslationStreamsCard } from '~/features/live-translation'

export const Route = createFileRoute('/dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Dashboard
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <LiveTranslationStreamsCard />
      </div>
    </div>
  )
}

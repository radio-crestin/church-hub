import { createFileRoute } from '@tanstack/react-router'

import { ScreenRenderer, WebSocketDebugPanel, useWebSocket } from '~/features/presentation'
import { useDebugMode } from '~/hooks/useDebugMode'

export const Route = createFileRoute('/screen/$screenId')({
  component: ScreenPage,
})

function ScreenPage() {
  const { screenId } = Route.useParams()
  const id = Number.parseInt(screenId, 10)
  const { isDebugMode } = useDebugMode()
  const { debugInfo } = useWebSocket()

  if (Number.isNaN(id) || id <= 0) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
        <p>Invalid screen ID</p>
      </div>
    )
  }

  return (
    <>
      <ScreenRenderer screenId={id} />
      {isDebugMode && <WebSocketDebugPanel debugInfo={debugInfo} />}
    </>
  )
}

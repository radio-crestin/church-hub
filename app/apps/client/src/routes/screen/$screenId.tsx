import { createFileRoute } from '@tanstack/react-router'

import {
  ScreenRenderer,
  useWebSocket,
  WebSocketDebugPanel,
} from '~/features/presentation'
import { useLiveProgramNavigation } from '~/features/schedules'
import { useDebugMode } from '~/hooks/useDebugMode'

export const Route = createFileRoute('/screen/$screenId')({
  component: ScreenPage,
})

function ScreenPage() {
  const { screenId } = Route.useParams()
  const id = Number.parseInt(screenId, 10)
  const { isDebugMode } = useDebugMode()
  const { debugInfo } = useWebSocket()
  // The projection window runs none of the control window's layout, so the
  // program its arrows walk is looked up here, as the control window's own
  // keyboard fallback does (AppLayout).
  const liveProgram = useLiveProgramNavigation()

  if (Number.isNaN(id) || id <= 0) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
        <p>Invalid screen ID</p>
      </div>
    )
  }

  return (
    <>
      <ScreenRenderer screenId={id} liveProgram={liveProgram} />
      {isDebugMode && <WebSocketDebugPanel debugInfo={debugInfo} />}
    </>
  )
}

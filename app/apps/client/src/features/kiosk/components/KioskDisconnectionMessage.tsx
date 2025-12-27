import { WifiOff } from 'lucide-react'

/**
 * Displays a disconnection message in the bottom left corner
 * when WebSocket connection is lost in kiosk mode
 */
export function KioskDisconnectionMessage() {
  return (
    <div className="fixed bottom-4 left-4 z-[9998] flex items-center gap-2 rounded-lg bg-black/80 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
      <WifiOff className="h-5 w-5 text-red-400" />
      <span className="text-sm font-medium">Connection lost</span>
    </div>
  )
}

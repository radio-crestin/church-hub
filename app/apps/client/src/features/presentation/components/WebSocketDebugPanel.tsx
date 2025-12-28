import { useEffect, useState } from 'react'

import { getLastAppliedUpdatedAt } from '../hooks/usePresentationControls'
import { usePresentationState } from '../hooks/usePresentationState'
import type { WebSocketDebugInfo } from '../hooks/useWebSocket'

interface WebSocketDebugPanelProps {
  debugInfo: WebSocketDebugInfo
}

export function WebSocketDebugPanel({ debugInfo }: WebSocketDebugPanelProps) {
  const { data: presentationState } = usePresentationState()
  const [lastAppliedAt, setLastAppliedAt] = useState(0)

  // Update lastAppliedAt periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLastAppliedAt(getLastAppliedUpdatedAt())
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const statusColor = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnected: 'bg-red-500',
    error: 'bg-red-700',
  }[debugInfo.status]

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  }

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return '-'
    return timestamp.toString()
  }

  // Get current slide index from presentation state
  const currentSlideIndex =
    presentationState?.temporaryContent?.type === 'song'
      ? presentationState.temporaryContent.data.currentSlideIndex
      : null

  return (
    <div className="fixed bottom-2 right-2 z-50 bg-black/90 text-white text-xs font-mono p-3 rounded-lg shadow-lg max-w-sm">
      <div className="flex items-center gap-2 mb-2 border-b border-gray-600 pb-2">
        <div className={`w-2 h-2 rounded-full ${statusColor}`} />
        <span className="font-bold">WebSocket Debug</span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Status:</span>
          <span className="text-right">{debugInfo.status}</span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-400">URL:</span>
          <span className="text-right truncate max-w-[180px]">
            {debugInfo.url || '-'}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Messages:</span>
          <span className="text-right">{debugInfo.messageCount}</span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-400">State msgs:</span>
          <span className="text-right">{debugInfo.presentationStateCount}</span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Stale blocked:</span>
          <span
            className={`text-right ${debugInfo.staleMessagesBlocked > 0 ? 'text-yellow-400' : ''}`}
          >
            {debugInfo.staleMessagesBlocked}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Last msg at:</span>
          <span className="text-right">
            {formatTime(debugInfo.lastMessageAt)}
          </span>
        </div>

        <div className="border-t border-gray-600 pt-1 mt-1">
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">WS updatedAt:</span>
            <span className="text-right text-[10px]">
              {formatTimestamp(debugInfo.lastPresentationUpdatedAt)}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Last applied:</span>
            <span className="text-right text-[10px]">
              {formatTimestamp(lastAppliedAt)}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-gray-400">State updatedAt:</span>
            <span className="text-right text-[10px]">
              {formatTimestamp(presentationState?.updatedAt ?? null)}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-600 pt-1 mt-1">
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">WS slide idx:</span>
            <span className="text-right">
              {debugInfo.lastSlideIndex !== null
                ? debugInfo.lastSlideIndex
                : '-'}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-gray-400">State slide idx:</span>
            <span className="text-right">
              {currentSlideIndex !== null ? currentSlideIndex : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

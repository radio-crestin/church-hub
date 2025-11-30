import {
  ChevronLeft,
  ChevronRight,
  Play,
  SkipForward,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePresentationSocket } from '../hooks/use-presentation-socket'
import {
  useClearQueue,
  useNextQueueItem,
  useQueue,
  useRemoveFromQueue,
  useSetCurrentSlide,
} from '../hooks/use-queue'
import type {
  QueueItemWithSession,
  QueueUpdateMessage,
  SessionUpdateMessage,
} from '../service/types'

interface QueueControlProps {
  className?: string
}

export function QueueControl({ className = '' }: QueueControlProps) {
  const { t } = useTranslation('common')
  const { data: queueState, refetch } = useQueue()
  const [localQueue, setLocalQueue] = useState<QueueItemWithSession[]>([])
  const [activePosition, setActivePosition] = useState(-1)

  const removeFromQueueMutation = useRemoveFromQueue()
  const nextQueueItemMutation = useNextQueueItem()
  const clearQueueMutation = useClearQueue()
  const setCurrentSlideMutation = useSetCurrentSlide()

  // Update local state from query
  useEffect(() => {
    if (queueState) {
      setLocalQueue(queueState.queue)
      setActivePosition(queueState.activePosition)
    }
  }, [queueState])

  // Handle WebSocket updates
  const handleQueueUpdate = useCallback(
    (payload: QueueUpdateMessage['payload']) => {
      setActivePosition(payload.activePosition)
      // Map to QueueItemWithSession format
      const mappedQueue = payload.queue.map((item) => ({
        id: item.id,
        position: item.position,
        session: {
          ...item.session,
          contentType: item.session.contentType as 'song' | 'bible' | 'text',
          slides: [], // Not included in queue update, will be fetched separately if needed
          currentSlide: item.session.currentSlide,
          title: item.session.title,
        },
      }))
      setLocalQueue(mappedQueue as QueueItemWithSession[])
    },
    [],
  )

  const handleSessionUpdate = useCallback(
    (payload: SessionUpdateMessage['payload']) => {
      setLocalQueue((prev) =>
        prev.map((item) =>
          item.session.id === payload.sessionId
            ? {
                ...item,
                session: {
                  ...item.session,
                  currentSlide: payload.currentSlide,
                },
              }
            : item,
        ),
      )
    },
    [],
  )

  usePresentationSocket({
    role: 'controller',
    onQueueUpdate: handleQueueUpdate,
    onSessionUpdate: handleSessionUpdate,
  })

  const handleRemove = async (queueItemId: number) => {
    await removeFromQueueMutation.mutateAsync(queueItemId)
    refetch()
  }

  const handleNext = async () => {
    await nextQueueItemMutation.mutateAsync()
    refetch()
  }

  const handleClear = async () => {
    await clearQueueMutation.mutateAsync()
    refetch()
  }

  const handleSlideChange = async (sessionId: number, slideIndex: number) => {
    await setCurrentSlideMutation.mutateAsync({ sessionId, slideIndex })
    refetch()
  }

  const activeItem = localQueue.find((item) => item.position === activePosition)

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Queue header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <h2 className="text-lg font-semibold">{t('presentation.queue')}</h2>
        <div className="flex gap-2">
          <button
            onClick={handleNext}
            disabled={localQueue.length === 0}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('presentation.nextItem')}
          >
            <SkipForward className="w-5 h-5" />
          </button>
          <button
            onClick={handleClear}
            disabled={localQueue.length === 0}
            className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('presentation.clearQueue')}
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {localQueue.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {t('presentation.emptyQueue')}
          </div>
        ) : (
          localQueue.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border ${
                item.position === activePosition
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-500">
                    {item.position + 1}
                  </span>
                  <div>
                    <div className="font-medium">{item.session.title}</div>
                    <div className="text-xs text-gray-500">
                      {item.session.contentType}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.position === activePosition && (
                    <Play className="w-4 h-4 text-indigo-600" />
                  )}
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Slide controls for active item */}
      {activeItem &&
        activeItem.session.slides &&
        activeItem.session.slides.length > 0 && (
          <div className="p-4 border-t dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {activeItem.session.title}
              </span>
              <span className="text-sm text-gray-500">
                {activeItem.session.currentSlide + 1} /{' '}
                {activeItem.session.slides.length}
              </span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() =>
                  handleSlideChange(
                    activeItem.session.id,
                    Math.max(0, activeItem.session.currentSlide - 1),
                  )
                }
                disabled={activeItem.session.currentSlide === 0}
                className="p-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() =>
                  handleSlideChange(
                    activeItem.session.id,
                    Math.min(
                      activeItem.session.slides.length - 1,
                      activeItem.session.currentSlide + 1,
                    ),
                  )
                }
                disabled={
                  activeItem.session.currentSlide >=
                  activeItem.session.slides.length - 1
                }
                className="p-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
    </div>
  )
}

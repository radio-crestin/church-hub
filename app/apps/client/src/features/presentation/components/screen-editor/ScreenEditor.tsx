import { useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Save, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

import { Button } from '~/ui/button/Button'
import { Combobox } from '~/ui/combobox/Combobox'
import { useEditorState } from './hooks/useEditorState'
import { ScreenEditorCanvas } from './ScreenEditorCanvas'
import { ScreenEditorSidebar } from './ScreenEditorSidebar'
import { useWebSocket } from '../../hooks'
import { screenQueryKey } from '../../hooks/useScreen'
import type {
  ContentType,
  Position,
  ScreenWithConfigs,
  Size,
} from '../../types'

interface ScreenEditorProps {
  screen: ScreenWithConfigs
  onSave: (screen: ScreenWithConfigs) => Promise<void>
  onClose: () => void
}

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: 'song', label: 'Song' },
  { value: 'bible', label: 'Bible Verse' },
  { value: 'bible_passage', label: 'Bible Passage' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'versete_tineri', label: 'Versete Tineri' },
  { value: 'empty', label: 'Empty / Clock' },
]

export function ScreenEditor({
  screen: initialScreen,
  onSave,
  onClose,
}: ScreenEditorProps) {
  const [state, actions] = useEditorState()
  const { send } = useWebSocket()
  const queryClient = useQueryClient()
  const lastEmitRef = useRef<number>(0)
  const isLocalUpdateRef = useRef<boolean>(false)

  // Initialize editor with screen data (only on mount)
  useEffect(() => {
    actions.setScreen(initialScreen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Subscribe to React Query cache changes for this screen (from WebSocket updates)
  useEffect(() => {
    const queryKey = screenQueryKey(initialScreen.id)
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.query.queryKey[0] === queryKey[0] &&
        event.query.queryKey[1] === queryKey[1]
      ) {
        // Skip if this is our own local update
        if (isLocalUpdateRef.current) {
          isLocalUpdateRef.current = false
          return
        }

        const newData = event.query.state.data as ScreenWithConfigs | undefined
        if (newData) {
          // Update local state with external changes (preserves isDirty)
          actions.setScreenExternal(newData)
        }
      }
    })

    return () => unsubscribe()
  }, [initialScreen.id, queryClient, actions])

  // Emit config changes via WebSocket (debounced to avoid flooding)
  useEffect(() => {
    if (!state.screen || !state.isDirty) return

    const emitUpdate = () => {
      // Mark as local update to prevent echo back
      isLocalUpdateRef.current = true
      send({
        type: 'screen_config_preview',
        payload: {
          screenId: state.screen!.id,
          config: state.screen,
        },
      })
      lastEmitRef.current = Date.now()
    }

    const now = Date.now()
    // Debounce: emit at most every 100ms
    const timeSinceLastEmit = now - lastEmitRef.current
    if (timeSinceLastEmit < 100) {
      const timeoutId = setTimeout(emitUpdate, 100 - timeSinceLastEmit)
      return () => clearTimeout(timeoutId)
    }

    emitUpdate()
  }, [state.screen, state.isDirty, send])

  const handleZoomIn = useCallback(() => {
    actions.setZoom(Math.min(state.zoom + 0.25, 2))
  }, [state.zoom, actions])

  const handleZoomOut = useCallback(() => {
    actions.setZoom(Math.max(state.zoom - 0.25, 0.5))
  }, [state.zoom, actions])

  const handleResetZoom = useCallback(() => {
    actions.setZoom(1)
  }, [actions])

  const handleSave = useCallback(async () => {
    if (!state.screen) return
    await onSave(state.screen)
    actions.markClean()
    // Emit final saved config
    send({
      type: 'screen_config_preview',
      payload: {
        screenId: state.screen.id,
        config: state.screen,
      },
    })
  }, [state.screen, onSave, actions, send])

  const handleClose = useCallback(() => {
    // Emit final config before closing (in case there are unsaved preview changes)
    if (state.screen) {
      send({
        type: 'screen_config_preview',
        payload: {
          screenId: state.screen.id,
          config: initialScreen, // Revert to original config on close without save
        },
      })
    }
    onClose()
  }, [state.screen, initialScreen, send, onClose])

  const handleUpdateElement = useCallback(
    (elementType: string, updates: { position?: Position; size?: Size }) => {
      if (!state.screen) return

      const config = state.screen.contentConfigs[state.selectedContentType]
      const newConfig = { ...config }

      // Update the specific element
      if (elementType === 'mainText' && 'mainText' in newConfig) {
        newConfig.mainText = {
          ...newConfig.mainText,
          ...(updates.position && { position: updates.position }),
          ...(updates.size && { size: updates.size }),
        }
      } else if (elementType === 'contentText' && 'contentText' in newConfig) {
        newConfig.contentText = {
          ...newConfig.contentText,
          ...(updates.position && { position: updates.position }),
          ...(updates.size && { size: updates.size }),
        }
      } else if (
        elementType === 'referenceText' &&
        'referenceText' in newConfig
      ) {
        newConfig.referenceText = {
          ...newConfig.referenceText,
          ...(updates.position && { position: updates.position }),
          ...(updates.size && { size: updates.size }),
        }
      } else if (elementType === 'personLabel' && 'personLabel' in newConfig) {
        newConfig.personLabel = {
          ...newConfig.personLabel,
          ...(updates.position && { position: updates.position }),
        }
      } else if (
        elementType === 'clock' &&
        'clock' in newConfig &&
        newConfig.clock
      ) {
        newConfig.clock = {
          ...newConfig.clock,
          ...(updates.position && { position: updates.position }),
        }
      } else if (elementType === 'nextSlide' && state.screen.nextSlideConfig) {
        actions.updateNextSlideConfig({
          ...state.screen.nextSlideConfig,
          ...(updates.position && { position: updates.position }),
          ...(updates.size && { size: updates.size }),
        })
        return
      }

      actions.updateContentConfig(
        state.selectedContentType,
        newConfig as typeof config,
      )
    },
    [state.screen, state.selectedContentType, actions],
  )

  if (!state.screen) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {state.screen.name}
          </h2>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">
            {state.screen.type}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Content type selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Preview:
            </span>
            <Combobox
              value={state.selectedContentType}
              onChange={(value) => {
                actions.setSelectedContentType(value as ContentType)
                actions.clearSelection()
              }}
              options={CONTENT_TYPE_OPTIONS}
              className="w-48"
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={state.zoom <= 0.5}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-center">
              {Math.round(state.zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={state.zoom >= 2}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleResetZoom}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {/* Save and close */}
          <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!state.isDirty}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button variant="ghost" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <ScreenEditorCanvas
          screen={state.screen}
          contentType={state.selectedContentType}
          selectedElement={state.selectedElement}
          zoom={state.zoom}
          onSelectElement={actions.setSelectedElement}
          onUpdateElement={handleUpdateElement}
        />

        {/* Right sidebar */}
        <ScreenEditorSidebar
          screen={state.screen}
          contentType={state.selectedContentType}
          selectedElement={state.selectedElement}
          onUpdateContentConfig={actions.updateContentConfig}
          onUpdateNextSlideConfig={actions.updateNextSlideConfig}
          onUpdateGlobalSettings={actions.updateGlobalSettings}
        />
      </div>
    </div>
  )
}

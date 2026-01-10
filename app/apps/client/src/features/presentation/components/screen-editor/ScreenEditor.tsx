import { useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Save, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '~/ui/button/Button'
import { Combobox } from '~/ui/combobox/Combobox'
import { useEditorState } from './hooks/useEditorState'
import { ScreenEditorCanvas } from './ScreenEditorCanvas'
import { ScreenEditorSidebar } from './ScreenEditorSidebar'
import { useWebSocket } from '../../hooks'
import { screenQueryKey } from '../../hooks/useScreen'
import type {
  Constraints,
  ContentType,
  ScreenWithConfigs,
  SizeWithUnits,
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
  { value: 'screen_share', label: 'Screen Share' },
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
  // Use a version counter to track save operations - more reliable than timeout
  const saveVersionRef = useRef<number>(0)
  const lastAppliedVersionRef = useRef<number>(0)
  // Portal container for dropdowns - use state to trigger re-render when set
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null,
  )

  // Initialize editor with screen data (only on mount)
  useEffect(() => {
    actions.setScreen(initialScreen)
    // Set initial version to match the current data
    lastAppliedVersionRef.current = Date.now()
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
        // Skip if we're in the middle of a save (saveVersionRef is newer than lastAppliedVersionRef)
        // This is more robust than a timeout - we track the actual save operation
        if (saveVersionRef.current > lastAppliedVersionRef.current) {
          // Update the last applied version to the save version after save completes
          lastAppliedVersionRef.current = saveVersionRef.current
          return
        }

        // Skip if this is our own local update
        if (isLocalUpdateRef.current) {
          isLocalUpdateRef.current = false
          return
        }

        const newData = event.query.state.data as ScreenWithConfigs | undefined
        if (newData) {
          // Update local state with external changes (preserves isDirty)
          actions.setScreenExternal(newData)
          lastAppliedVersionRef.current = Date.now()
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
    // Mark the save version so we can ignore cache updates during/after save
    saveVersionRef.current = Date.now()
    try {
      await onSave(state.screen)
      actions.markClean()
      // Update the last applied version to match the save version
      lastAppliedVersionRef.current = saveVersionRef.current
      // Emit final saved config
      send({
        type: 'screen_config_preview',
        payload: {
          screenId: state.screen.id,
          config: state.screen,
        },
      })
    } catch {
      // On error, reset the save version so we don't ignore future updates
      saveVersionRef.current = lastAppliedVersionRef.current
      throw new Error('Save failed')
    }
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
    (
      elementType: string,
      updates: { constraints?: Constraints; size?: SizeWithUnits },
    ) => {
      if (!state.screen) return

      const config = state.screen.contentConfigs[state.selectedContentType]
      const newConfig = { ...config }

      // Update the specific element with constraints and size
      if (elementType === 'mainText' && 'mainText' in newConfig) {
        newConfig.mainText = {
          ...newConfig.mainText,
          ...(updates.constraints && { constraints: updates.constraints }),
          ...(updates.size && { size: updates.size }),
        }
      } else if (elementType === 'contentText' && 'contentText' in newConfig) {
        newConfig.contentText = {
          ...newConfig.contentText,
          ...(updates.constraints && { constraints: updates.constraints }),
          ...(updates.size && { size: updates.size }),
        }
      } else if (
        elementType === 'referenceText' &&
        'referenceText' in newConfig
      ) {
        newConfig.referenceText = {
          ...newConfig.referenceText,
          ...(updates.constraints && { constraints: updates.constraints }),
          ...(updates.size && { size: updates.size }),
        }
      } else if (elementType === 'personLabel' && 'personLabel' in newConfig) {
        newConfig.personLabel = {
          ...newConfig.personLabel,
          ...(updates.constraints && { constraints: updates.constraints }),
          ...(updates.size && { size: updates.size }),
        }
      } else if (
        elementType === 'clock' &&
        state.screen.globalSettings.clockConfig
      ) {
        // Clock uses global settings, not content config
        actions.updateGlobalSettings({
          ...state.screen.globalSettings,
          clockConfig: {
            ...state.screen.globalSettings.clockConfig,
            ...(updates.constraints && { constraints: updates.constraints }),
            ...(updates.size && { size: updates.size }),
          },
        })
        return
      } else if (elementType === 'nextSlide' && state.screen.nextSlideConfig) {
        // Pass only the changed fields - updateNextSlideConfig will merge with previous state
        actions.updateNextSlideConfig({
          ...(updates.constraints && { constraints: updates.constraints }),
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
              portalContainer={portalContainer}
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
          previewTexts={state.previewTexts[state.selectedContentType]}
          onSelectElement={actions.setSelectedElement}
          onUpdateElement={handleUpdateElement}
        />

        {/* Right sidebar */}
        <ScreenEditorSidebar
          screen={state.screen}
          contentType={state.selectedContentType}
          selectedElement={state.selectedElement}
          previewTexts={state.previewTexts[state.selectedContentType]}
          onSetPreviewText={(key, text) =>
            actions.setPreviewText(state.selectedContentType, key, text)
          }
          onResetPreviewTexts={() =>
            actions.resetPreviewTexts(state.selectedContentType)
          }
          onUpdateContentConfig={actions.updateContentConfig}
          onUpdateNextSlideConfig={actions.updateNextSlideConfig}
          onUpdateGlobalSettings={actions.updateGlobalSettings}
          onUpdateScreenDimensions={actions.updateScreenDimensions}
          portalContainer={portalContainer}
        />
      </div>
      {/* Portal container for dropdowns - rendered last to be on top */}
      <div
        ref={setPortalContainer}
        className="fixed inset-0 z-[9999] pointer-events-none [&>*]:pointer-events-auto"
      />
    </div>
  )
}

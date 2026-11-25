import { RotateCcw, Save, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import { DesignPanel } from './design/DesignPanel'
import { useEditorState } from './hooks/useEditorState'
import { ScreenEditorCanvas } from './ScreenEditorCanvas'
import { ScreenEditorSidebar } from './ScreenEditorSidebar'
import { SlideTypeStrip } from './SlideTypeStrip'
import { toTemplateDesign } from './toTemplateDesign'
import { useWebSocket } from '../../hooks'
import type {
  Constraints,
  ContentType,
  ScreenWithConfigs,
  SizeWithUnits,
} from '../../types'

interface ScreenEditorProps {
  /**
   * The screen drawing the template being edited, kept current: a save made
   * elsewhere while editing arrives through it.
   */
  screen: ScreenWithConfigs
  /** The template's name, shown as the title. */
  title: string
  /** The slide shown first (the song by default). */
  initialContentType?: ContentType
  onSave: (screen: ScreenWithConfigs) => Promise<void>
  onClose: () => void
}

/**
 * Edits a slide template: one layout per slide type, the clock and the
 * next-slide strip. Every screen drawing with the template shows the unsaved
 * design live, and goes back to the saved one when editing is left unsaved.
 */
export function ScreenEditor({
  screen,
  title,
  initialContentType,
  onSave,
  onClose,
}: ScreenEditorProps) {
  const [state, actions] = useEditorState()
  const { t } = useTranslation('presentation')
  const { send } = useWebSocket()
  const lastEmitRef = useRef<number>(0)
  const savingRef = useRef(false)
  // Portal container for dropdowns - use state to trigger re-render when set
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null,
  )
  // The right pane: the whole theme's design, or the chosen slide's own.
  const [pane, setPane] = useState<'design' | 'slide'>('slide')

  // Initialize editor with screen data (only on mount)
  useEffect(() => {
    actions.setScreen(screen)
    if (initialContentType) actions.setSelectedContentType(initialContentType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A save made elsewhere while editing (keeps this editor's unsaved state flag)
  const firstScreenRef = useRef(screen)
  useEffect(() => {
    if (screen === firstScreenRef.current || savingRef.current) return
    actions.setScreenExternal(screen)
  }, [screen, actions])

  const templateId = screen.templateId
  const sendPreview = useCallback(
    (design: ReturnType<typeof toTemplateDesign> | null) =>
      send({ type: 'slide_template_preview', payload: { templateId, design } }),
    [send, templateId],
  )

  // Emit the unsaved design (debounced to avoid flooding)
  useEffect(() => {
    if (!state.screen || !state.isDirty) return
    const design = toTemplateDesign(state.screen)
    const emitUpdate = () => {
      sendPreview(design)
      lastEmitRef.current = Date.now()
    }
    const timeSinceLastEmit = Date.now() - lastEmitRef.current
    if (timeSinceLastEmit < 100) {
      const timeoutId = setTimeout(emitUpdate, 100 - timeSinceLastEmit)
      return () => clearTimeout(timeoutId)
    }
    emitUpdate()
  }, [state.screen, state.isDirty, sendPreview])

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
    savingRef.current = true
    try {
      await onSave(state.screen)
      actions.markClean()
    } finally {
      savingRef.current = false
    }
  }, [state.screen, onSave, actions])

  const handleClose = useCallback(() => {
    // Screens showing the unsaved design go back to the saved one
    if (state.isDirty) sendPreview(null)
    onClose()
  }, [state.isDirty, sendPreview, onClose])

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
      } else if (
        elementType === 'songKey' &&
        'songKey' in newConfig &&
        newConfig.songKey
      ) {
        newConfig.songKey = {
          ...newConfig.songKey,
          ...(updates.constraints && { constraints: updates.constraints }),
          ...(updates.size && { size: updates.size }),
        }
      } else if (
        elementType === 'amen' &&
        'amen' in newConfig &&
        newConfig.amen
      ) {
        newConfig.amen = {
          ...newConfig.amen,
          ...(updates.constraints && { constraints: updates.constraints }),
          ...(updates.size && { size: updates.size }),
        }
      } else if (
        elementType === 'songTitle' &&
        'songTitle' in newConfig &&
        newConfig.songTitle
      ) {
        newConfig.songTitle = {
          ...newConfig.songTitle,
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
      {/* Toolbar: name and save on the first row of a phone, the slide
          type picker under them; one row from sm up */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-none">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {title}
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 order-last sm:order-none w-full sm:w-auto sm:ml-auto">
          {/* Zoom controls: pinch zoom does it on a phone */}
          <div className="hidden sm:flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={state.zoom <= 0.5}
              title={t('screens.editor.zoomOut')}
              aria-label={t('screens.editor.zoomOut')}
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
              title={t('screens.editor.zoomIn')}
              aria-label={t('screens.editor.zoomIn')}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetZoom}
              title={t('screens.editor.resetZoom')}
              aria-label={t('screens.editor.resetZoom')}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Save and close */}
        <div className="flex items-center gap-2 sm:border-l border-gray-200 dark:border-gray-700 sm:pl-4">
          {state.isDirty && (
            <span
              data-testid="screen-editor-unsaved"
              className="hidden md:inline text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap"
            >
              {t('screens.editor.unsavedChanges')}
            </span>
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!state.isDirty}
            data-testid="screen-editor-save"
          >
            <Save className="w-4 h-4 mr-2" />
            {t('screens.editor.save')}
          </Button>
          <Button
            variant="ghost"
            onClick={handleClose}
            title={t('screens.editor.close')}
            aria-label={t('screens.editor.close')}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main content: stacked on mobile (canvas on top, controls below),
          side-by-side from md up */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        {/* Every slide type as a slide, like PowerPoint's slide list */}
        <SlideTypeStrip
          screen={state.screen}
          selected={state.selectedContentType}
          onSelect={(contentType) => {
            actions.setSelectedContentType(contentType)
            actions.clearSelection()
          }}
        />

        {/* Canvas area */}
        <ScreenEditorCanvas
          screen={state.screen}
          contentType={state.selectedContentType}
          selectedElement={state.selectedElement}
          zoom={state.zoom}
          previewTexts={state.previewTexts[state.selectedContentType]}
          onSelectElement={(element) => {
            actions.setSelectedElement(element)
            if (element) setPane('slide')
          }}
          onUpdateElement={handleUpdateElement}
        />

        {/* Right pane: the theme's design, or this slide's settings */}
        <div className="w-full flex-1 min-h-0 md:flex-none md:w-96 md:flex-shrink-0 bg-white dark:bg-gray-900 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
          <div
            role="tablist"
            className="sticky top-0 z-10 flex gap-1 border-b border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900"
          >
            {(['design', 'slide'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={pane === value}
                data-testid={`screen-editor-tab-${value}`}
                onClick={() => setPane(value)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
                  pane === value
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {t(`templates.editor.${value}`)}
              </button>
            ))}
          </div>
          {pane === 'design' ? (
            <DesignPanel
              screen={state.screen}
              onChange={actions.updateScreen}
              portalContainer={portalContainer}
            />
          ) : (
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
              onSelectElement={actions.setSelectedElement}
              onUpdateContentConfig={actions.updateContentConfig}
              onUpdateNextSlideConfig={actions.updateNextSlideConfig}
              onUpdateGlobalSettings={actions.updateGlobalSettings}
              onUpdateScreenDimensions={actions.updateScreenDimensions}
              portalContainer={portalContainer}
            />
          )}
        </div>
      </div>
      {/* Portal container for dropdowns - rendered last to be on top */}
      <div
        ref={setPortalContainer}
        className="fixed inset-0 z-[9999] pointer-events-none [&>*]:pointer-events-auto"
      />
    </div>
  )
}

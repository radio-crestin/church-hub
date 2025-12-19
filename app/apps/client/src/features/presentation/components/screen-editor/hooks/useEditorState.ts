import { useCallback, useMemo, useState } from 'react'

import type {
  ContentType,
  ContentTypeConfig,
  NextSlideSectionConfig,
  ScreenGlobalSettings,
  ScreenWithConfigs,
} from '../../../types'

export type SelectedElement =
  | { type: 'mainText' }
  | { type: 'contentText' }
  | { type: 'referenceText' }
  | { type: 'personLabel' }
  | { type: 'clock' }
  | { type: 'nextSlide' }
  | null

interface EditorState {
  screen: ScreenWithConfigs | null
  selectedContentType: ContentType
  selectedElement: SelectedElement
  zoom: number
  isDirty: boolean
}

interface EditorActions {
  setScreen: (screen: ScreenWithConfigs) => void
  setScreenExternal: (screen: ScreenWithConfigs) => void
  setSelectedContentType: (contentType: ContentType) => void
  setSelectedElement: (element: SelectedElement) => void
  setZoom: (zoom: number) => void
  updateContentConfig: (
    contentType: ContentType,
    config: ContentTypeConfig,
  ) => void
  updateNextSlideConfig: (config: NextSlideSectionConfig) => void
  updateGlobalSettings: (settings: ScreenGlobalSettings) => void
  clearSelection: () => void
  markClean: () => void
}

export function useEditorState(): [EditorState, EditorActions] {
  const [screen, setScreenState] = useState<ScreenWithConfigs | null>(null)
  const [selectedContentType, setSelectedContentType] =
    useState<ContentType>('song')
  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null)
  const [zoom, setZoom] = useState(1)
  const [isDirty, setIsDirty] = useState(false)

  const setScreen = useCallback((newScreen: ScreenWithConfigs) => {
    setScreenState(newScreen)
    setIsDirty(false)
  }, [])

  // Updates screen without resetting isDirty - for external updates while editing
  const setScreenExternal = useCallback((newScreen: ScreenWithConfigs) => {
    setScreenState(newScreen)
  }, [])

  const updateContentConfig = useCallback(
    (contentType: ContentType, config: ContentTypeConfig) => {
      setScreenState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          contentConfigs: {
            ...prev.contentConfigs,
            [contentType]: config,
          },
        }
      })
      setIsDirty(true)
    },
    [],
  )

  const updateNextSlideConfig = useCallback(
    (config: NextSlideSectionConfig) => {
      setScreenState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          nextSlideConfig: config,
        }
      })
      setIsDirty(true)
    },
    [],
  )

  const updateGlobalSettings = useCallback((settings: ScreenGlobalSettings) => {
    setScreenState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        globalSettings: settings,
      }
    })
    setIsDirty(true)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedElement(null)
  }, [])

  const markClean = useCallback(() => {
    setIsDirty(false)
  }, [])

  const actions = useMemo(
    () => ({
      setScreen,
      setScreenExternal,
      setSelectedContentType,
      setSelectedElement,
      setZoom,
      updateContentConfig,
      updateNextSlideConfig,
      updateGlobalSettings,
      clearSelection,
      markClean,
    }),
    [
      setScreen,
      setScreenExternal,
      setSelectedContentType,
      setSelectedElement,
      setZoom,
      updateContentConfig,
      updateNextSlideConfig,
      updateGlobalSettings,
      clearSelection,
      markClean,
    ],
  )

  return [
    {
      screen,
      selectedContentType,
      selectedElement,
      zoom,
      isDirty,
    },
    actions,
  ]
}

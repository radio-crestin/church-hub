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
  | { type: 'songKey' }
  | { type: 'amen' }
  | { type: 'personLabel' }
  | { type: 'clock' }
  | { type: 'nextSlide' }
  | null

export interface PreviewTexts {
  main?: string
  reference?: string
  person?: string
}

export type PreviewTextKey = keyof PreviewTexts

type PreviewTextsMap = Record<ContentType, PreviewTexts>

const createEmptyPreviewTexts = (): PreviewTextsMap => ({
  song: {},
  song_first_slide: {},
  song_last_slide: {},
  bible: {},
  bible_passage: {},
  announcement: {},
  versete_tineri: {},
  empty: {},
  screen_share: {},
})

interface EditorState {
  screen: ScreenWithConfigs | null
  effectiveScreen: ScreenWithConfigs | null
  selectedContentType: ContentType
  selectedScene: string | null
  selectedElement: SelectedElement
  zoom: number
  isDirty: boolean
  previewTexts: PreviewTextsMap
}

interface EditorActions {
  setScreen: (screen: ScreenWithConfigs) => void
  setScreenExternal: (screen: ScreenWithConfigs) => void
  setSelectedContentType: (contentType: ContentType) => void
  setSelectedScene: (scene: string | null) => void
  setSelectedElement: (element: SelectedElement) => void
  setZoom: (zoom: number) => void
  updateContentConfig: (
    contentType: ContentType,
    config: ContentTypeConfig,
  ) => void
  updateNextSlideConfig: (config: Partial<NextSlideSectionConfig>) => void
  updateGlobalSettings: (settings: ScreenGlobalSettings) => void
  updateScreenDimensions: (width: number, height: number) => void
  clearSelection: () => void
  markClean: () => void
  setPreviewText: (
    contentType: ContentType,
    key: keyof PreviewTexts,
    text: string,
  ) => void
  resetPreviewTexts: (contentType: ContentType) => void
}

export function useEditorState(): [EditorState, EditorActions] {
  const [screen, setScreenState] = useState<ScreenWithConfigs | null>(null)
  const [selectedContentType, setSelectedContentType] =
    useState<ContentType>('song')
  const [selectedScene, setSelectedScene] = useState<string | null>(null)
  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null)
  const [zoom, setZoom] = useState(1)
  const [isDirty, setIsDirty] = useState(false)
  const [previewTexts, setPreviewTexts] = useState<PreviewTextsMap>(
    createEmptyPreviewTexts,
  )

  // Compute effective screen with scene overrides applied to contentConfigs
  const effectiveScreen = useMemo(() => {
    if (!screen || !selectedScene) return screen
    const overrides = screen.sceneOverrides?.[selectedScene]
    if (!overrides) return screen
    const merged = { ...screen.contentConfigs } as Record<string, unknown>
    for (const [ct, config] of Object.entries(overrides)) {
      merged[ct] = config
    }
    return {
      ...screen,
      contentConfigs: merged as unknown as ScreenWithConfigs['contentConfigs'],
    }
  }, [screen, selectedScene])

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
        if (selectedScene) {
          // Update scene override - store as Record<string, unknown>
          const existingOverrides = prev.sceneOverrides ?? {}
          const sceneConfigs = existingOverrides[selectedScene] ?? {}
          return {
            ...prev,
            sceneOverrides: {
              ...existingOverrides,
              [selectedScene]: {
                ...sceneConfigs,
                [contentType]: config as unknown as Record<string, unknown>,
              },
            },
          }
        }
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
    [selectedScene],
  )

  const updateNextSlideConfig = useCallback(
    (config: Partial<NextSlideSectionConfig>) => {
      setScreenState((prev) => {
        if (!prev || !prev.nextSlideConfig) return prev
        return {
          ...prev,
          nextSlideConfig: {
            ...prev.nextSlideConfig,
            ...config,
          },
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

  const updateScreenDimensions = useCallback(
    (width: number, height: number) => {
      setScreenState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          width,
          height,
        }
      })
      setIsDirty(true)
    },
    [],
  )

  const clearSelection = useCallback(() => {
    setSelectedElement(null)
  }, [])

  const markClean = useCallback(() => {
    setIsDirty(false)
  }, [])

  const setPreviewText = useCallback(
    (contentType: ContentType, key: keyof PreviewTexts, text: string) => {
      setPreviewTexts((prev) => ({
        ...prev,
        [contentType]: {
          ...prev[contentType],
          [key]: text,
        },
      }))
    },
    [],
  )

  const resetPreviewTexts = useCallback((contentType: ContentType) => {
    setPreviewTexts((prev) => ({
      ...prev,
      [contentType]: {},
    }))
  }, [])

  const actions = useMemo(
    () => ({
      setScreen,
      setScreenExternal,
      setSelectedContentType,
      setSelectedScene,
      setSelectedElement,
      setZoom,
      updateContentConfig,
      updateNextSlideConfig,
      updateGlobalSettings,
      updateScreenDimensions,
      clearSelection,
      markClean,
      setPreviewText,
      resetPreviewTexts,
    }),
    [
      setScreen,
      setScreenExternal,
      setSelectedContentType,
      setSelectedScene,
      setSelectedElement,
      setZoom,
      updateContentConfig,
      updateNextSlideConfig,
      updateGlobalSettings,
      updateScreenDimensions,
      clearSelection,
      markClean,
      setPreviewText,
      resetPreviewTexts,
    ],
  )

  return [
    {
      screen,
      effectiveScreen,
      selectedContentType,
      selectedScene,
      selectedElement,
      zoom,
      isDirty,
      previewTexts,
    },
    actions,
  ]
}

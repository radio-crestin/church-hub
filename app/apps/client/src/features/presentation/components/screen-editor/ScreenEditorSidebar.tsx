import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ElementSettings } from './ElementSettings'
import { getElementConfig } from './getElementConfig'
import type {
  PreviewTextKey,
  PreviewTexts,
  SelectedElement,
} from './hooks/useEditorState'
import { SlideTypeSettings } from './SlideTypeSettings'
import { WholeScreenSettings } from './WholeScreenSettings'
import type {
  ContentType,
  ContentTypeConfig,
  NextSlideSectionConfig,
  ScreenGlobalSettings,
  ScreenWithConfigs,
} from '../../types'
import { getDefaultBackground } from '../../utils/defaultConfigs'

interface ScreenEditorSidebarProps {
  screen: ScreenWithConfigs
  contentType: ContentType
  selectedElement: SelectedElement
  previewTexts?: PreviewTexts
  onSetPreviewText?: (key: PreviewTextKey, text: string) => void
  onResetPreviewTexts?: () => void
  onSelectElement: (element: SelectedElement) => void
  onUpdateContentConfig: (
    contentType: ContentType,
    config: ContentTypeConfig,
  ) => void
  onUpdateNextSlideConfig: (config: Partial<NextSlideSectionConfig>) => void
  onUpdateGlobalSettings: (settings: ScreenGlobalSettings) => void
  onUpdateScreenDimensions: (width: number, height: number) => void
  portalContainer?: HTMLElement | null
}

/**
 * The screen editor's settings: the picked element's when one is selected,
 * otherwise the slide type's own settings followed by the whole screen's.
 */
export function ScreenEditorSidebar({
  screen,
  contentType,
  selectedElement,
  previewTexts,
  onSetPreviewText,
  onResetPreviewTexts,
  onSelectElement,
  onUpdateContentConfig,
  onUpdateNextSlideConfig,
  onUpdateGlobalSettings,
  onUpdateScreenDimensions,
  portalContainer,
}: ScreenEditorSidebarProps) {
  const { t } = useTranslation('presentation')
  // Normalize the active content config so the Background controls (and any
  // other field access) never crash on a config that drifted to lack a
  // `background` — e.g. configs saved by older app versions or partial OBS
  // scene overrides merged in client-side. Falls back to a sensible default.
  const config = useMemo(() => {
    const raw = screen.contentConfigs[contentType] as
      | ContentTypeConfig
      | undefined
    if (raw && raw.background) return raw
    return {
      ...(raw ?? {}),
      background: getDefaultBackground(),
    } as ContentTypeConfig
  }, [screen.contentConfigs, contentType])

  // Writes values at nested paths of the slide type's config in one change.
  const updateConfig = (updates: Array<{ path: string[]; value: unknown }>) => {
    const newConfig = JSON.parse(JSON.stringify(config))
    for (const { path, value } of updates) {
      let current = newConfig
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]]
      }
      current[path[path.length - 1]] = value
    }
    onUpdateContentConfig(contentType, newConfig)
  }

  return (
    <div
      data-testid="screen-editor-sidebar"
      className="w-full flex-1 min-h-0 md:flex-none md:w-96 md:flex-shrink-0 bg-white dark:bg-gray-900 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 overflow-y-auto"
    >
      {selectedElement &&
      getElementConfig(screen, config, selectedElement.type) ? (
        <ElementSettings
          screen={screen}
          config={config}
          element={selectedElement}
          previewTexts={previewTexts}
          onSetPreviewText={onSetPreviewText}
          onResetPreviewTexts={onResetPreviewTexts}
          onUpdateConfig={updateConfig}
          onUpdateNextSlideConfig={onUpdateNextSlideConfig}
          onUpdateGlobalSettings={onUpdateGlobalSettings}
          onBack={() => onSelectElement(null)}
          portalContainer={portalContainer}
        />
      ) : (
        <>
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('screens.sections.screenSettings')}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t('screens.editor.selectHint')}
            </p>
          </div>
          <SlideTypeSettings
            screen={screen}
            contentType={contentType}
            config={config}
            onUpdateContentConfig={onUpdateContentConfig}
            onSelectElement={onSelectElement}
            portalContainer={portalContainer}
          />
          <WholeScreenSettings
            screen={screen}
            onUpdateNextSlideConfig={onUpdateNextSlideConfig}
            onUpdateGlobalSettings={onUpdateGlobalSettings}
            onUpdateScreenDimensions={onUpdateScreenDimensions}
          />
        </>
      )}
    </div>
  )
}

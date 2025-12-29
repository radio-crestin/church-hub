import {
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Film,
  Move,
  Palette,
  Settings,
  Type,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import { Checkbox } from '~/ui/checkbox/Checkbox'
import { Combobox } from '~/ui/combobox/Combobox'
import { Input } from '~/ui/input/Input'
import { Label } from '~/ui/label/Label'
import { Slider } from '~/ui/slider/Slider'
import { ConstraintControls } from './ConstraintControls'
import type {
  PreviewTextKey,
  PreviewTexts,
  SelectedElement,
} from './hooks/useEditorState'
import type {
  AnimationConfig,
  BibleContentConfig,
  ClockElementConfig,
  Constraints,
  ContentType,
  ContentTypeConfig,
  NextSlideSectionConfig,
  PersonLabelConfig,
  ReferenceTextConfig,
  ScreenBackgroundConfig,
  ScreenGlobalSettings,
  ScreenWithConfigs,
  SizeWithUnits,
  TextStyle,
} from '../../types'

interface ScreenEditorSidebarProps {
  screen: ScreenWithConfigs
  contentType: ContentType
  selectedElement: SelectedElement
  previewTexts?: PreviewTexts
  onSetPreviewText?: (key: PreviewTextKey, text: string) => void
  onResetPreviewTexts?: () => void
  onUpdateContentConfig: (
    contentType: ContentType,
    config: ContentTypeConfig,
  ) => void
  onUpdateNextSlideConfig: (config: Partial<NextSlideSectionConfig>) => void
  onUpdateGlobalSettings: (settings: ScreenGlobalSettings) => void
  onUpdateScreenDimensions: (width: number, height: number) => void
}

// Collapsible section component
function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <button
        className="flex items-center w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
        )}
        <Icon className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
          {title}
        </span>
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  )
}

// Font family options
const FONT_FAMILIES = [
  { value: 'system-ui', label: 'System Default' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Verdana', label: 'Verdana' },
]

// Animation type options
const ANIMATION_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'blur', label: 'Blur' },
]

// Background type options
const BACKGROUND_TYPES = [
  { value: 'transparent', label: 'Transparent' },
  { value: 'color', label: 'Solid Color' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
]

// Line separator options
const LINE_SEPARATORS = [
  { value: 'space', key: 'space' },
  { value: 'dash', key: 'dash' },
  { value: 'pipe', key: 'pipe' },
]

// Default animation config for elements that may be missing it (backwards compatibility)
const DEFAULT_ANIMATION_IN: AnimationConfig = {
  type: 'fade',
  duration: 300,
  delay: 0,
  easing: 'ease-out',
}

const DEFAULT_ANIMATION_OUT: AnimationConfig = {
  type: 'fade',
  duration: 200,
  delay: 0,
  easing: 'ease-in',
}

const DEFAULT_SLIDE_TRANSITION: AnimationConfig = {
  type: 'fade',
  duration: 250,
  delay: 0,
  easing: 'ease-out',
}

export function ScreenEditorSidebar({
  screen,
  contentType,
  selectedElement,
  previewTexts,
  onSetPreviewText,
  onResetPreviewTexts,
  onUpdateContentConfig,
  onUpdateNextSlideConfig,
  onUpdateGlobalSettings,
  onUpdateScreenDimensions,
}: ScreenEditorSidebarProps) {
  const { t } = useTranslation('presentation')
  const config = screen.contentConfigs[contentType]

  // Helper to update a nested property in the config
  const updateConfig = (path: string[], value: unknown) => {
    const newConfig = JSON.parse(JSON.stringify(config))
    let current = newConfig
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]]
    }
    current[path[path.length - 1]] = value
    onUpdateContentConfig(contentType, newConfig)
  }

  // Helper to update multiple nested properties at once (avoids overwriting)
  const updateConfigMultiple = (
    updates: Array<{ path: string[]; value: unknown }>,
  ) => {
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

  // Get the currently selected element's config
  // Ensures referenceText and personLabel always have animation configs (backwards compatibility)
  const getSelectedElementConfig = () => {
    if (!selectedElement) return null

    switch (selectedElement.type) {
      case 'mainText':
        return 'mainText' in config
          ? { path: ['mainText'], config: config.mainText }
          : null
      case 'contentText':
        return 'contentText' in config
          ? { path: ['contentText'], config: config.contentText }
          : null
      case 'referenceText':
        if (!('referenceText' in config)) return null
        // Ensure animation configs exist for backwards compatibility
        const refConfig = config.referenceText as ReferenceTextConfig
        return {
          path: ['referenceText'],
          config: {
            ...refConfig,
            animationIn: refConfig.animationIn ?? DEFAULT_ANIMATION_IN,
            animationOut: refConfig.animationOut ?? DEFAULT_ANIMATION_OUT,
            slideTransition:
              refConfig.slideTransition ?? DEFAULT_SLIDE_TRANSITION,
          },
        }
      case 'personLabel':
        if (!('personLabel' in config)) return null
        // Ensure animation configs exist for backwards compatibility
        const personConfig = config.personLabel as PersonLabelConfig
        return {
          path: ['personLabel'],
          config: {
            ...personConfig,
            animationIn: personConfig.animationIn ?? DEFAULT_ANIMATION_IN,
            animationOut: personConfig.animationOut ?? DEFAULT_ANIMATION_OUT,
            slideTransition:
              personConfig.slideTransition ?? DEFAULT_SLIDE_TRANSITION,
          },
        }
      case 'clock':
        // Clock uses global settings, not content config
        return screen.globalSettings.clockConfig
          ? { path: [], config: screen.globalSettings.clockConfig, isClock: true }
          : null
      case 'nextSlide':
        return screen.nextSlideConfig
          ? { path: [], config: screen.nextSlideConfig, isNextSlide: true }
          : null
      default:
        return null
    }
  }

  const selectedConfig = getSelectedElementConfig()

  // Helper to update next slide text styles
  const updateNextSlideStyle = (
    styleKey: 'labelStyle' | 'contentStyle',
    updates: Partial<TextStyle>,
  ) => {
    if (!screen.nextSlideConfig) return
    onUpdateNextSlideConfig({
      ...screen.nextSlideConfig,
      [styleKey]: {
        ...screen.nextSlideConfig[styleKey],
        ...updates,
      },
    })
  }

  // Helper to update clock style (stored in global settings)
  const updateClockStyle = (updates: Partial<TextStyle>) => {
    if (!screen.globalSettings.clockConfig) return
    onUpdateGlobalSettings({
      ...screen.globalSettings,
      clockConfig: {
        ...screen.globalSettings.clockConfig,
        style: {
          ...screen.globalSettings.clockConfig.style,
          ...updates,
        },
      },
    })
  }

  // Helper to update element style - handles clock vs regular elements
  const updateElementStyle = (updates: Partial<TextStyle>) => {
    if (!selectedConfig) return
    if (selectedConfig.isClock) {
      updateClockStyle(updates)
    } else {
      const currentStyle = (selectedConfig.config as { style: TextStyle }).style
      updateConfig([...selectedConfig.path, 'style'], {
        ...currentStyle,
        ...updates,
      })
    }
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
      {selectedElement && selectedConfig ? (
        // Element-specific configuration
        <>
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200 capitalize">
              {selectedElement.type.replace(/([A-Z])/g, ' $1').trim()}
            </h3>
          </div>

          {/* Position Section */}
          {'constraints' in selectedConfig.config && (
            <Section title="Position" icon={Move}>
              <ConstraintControls
                constraints={
                  (selectedConfig.config as { constraints: Constraints })
                    .constraints
                }
                size={
                  (selectedConfig.config as { size?: SizeWithUnits }).size ?? {
                    width: 10,
                    widthUnit: '%',
                    height: 5,
                    heightUnit: '%',
                  }
                }
                screenWidth={screen.width}
                screenHeight={screen.height}
                onChange={(newConstraints, newSize) => {
                  if (selectedConfig.isNextSlide) {
                    onUpdateNextSlideConfig({
                      ...screen.nextSlideConfig!,
                      constraints: newConstraints,
                      size: newSize,
                    })
                  } else if (selectedConfig.isClock) {
                    // Clock uses global settings
                    onUpdateGlobalSettings({
                      ...screen.globalSettings,
                      clockConfig: {
                        ...screen.globalSettings.clockConfig!,
                        constraints: newConstraints,
                        size: newSize,
                      },
                    })
                  } else {
                    // Update both constraints and size together to avoid overwrites
                    updateConfigMultiple([
                      {
                        path: [...selectedConfig.path, 'constraints'],
                        value: newConstraints,
                      },
                      {
                        path: [...selectedConfig.path, 'size'],
                        value: newSize,
                      },
                    ])
                  }
                }}
              />
            </Section>
          )}

          {/* Visibility Section */}
          {'constraints' in selectedConfig.config && (
            <Section
              title={t('screens.panels.visibility')}
              icon={Eye}
              defaultOpen={false}
            >
              <Checkbox
                checked={
                  (
                    selectedConfig.config as {
                      hidden?: boolean
                    }
                  ).hidden ?? false
                }
                onCheckedChange={(checked) => {
                  if (selectedConfig.isNextSlide) {
                    onUpdateNextSlideConfig({
                      ...screen.nextSlideConfig!,
                      hidden: !!checked,
                    })
                  } else if (selectedConfig.isClock) {
                    // Clock uses global settings
                    onUpdateGlobalSettings({
                      ...screen.globalSettings,
                      clockConfig: {
                        ...screen.globalSettings.clockConfig!,
                        hidden: !!checked,
                      },
                    })
                  } else {
                    updateConfig([...selectedConfig.path, 'hidden'], !!checked)
                  }
                }}
                label={t('screens.visibility.hideElement')}
              />
            </Section>
          )}

          {/* Text Style Section */}
          {'style' in selectedConfig.config && (
            <Section title="Text Style" icon={Type}>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    Font Family
                  </Label>
                  <Combobox
                    value={
                      (selectedConfig.config as { style: TextStyle }).style
                        .fontFamily
                    }
                    onChange={(value) => {
                      updateElementStyle({ fontFamily: value })
                    }}
                    options={FONT_FAMILIES}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Checkbox
                    checked={
                      (selectedConfig.config as { style: TextStyle }).style
                        .autoScale ?? true
                    }
                    onCheckedChange={(checked) => {
                      updateElementStyle({ autoScale: !!checked })
                    }}
                    label={t('screens.textStyle.autoScale')}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                    {t('screens.textStyle.autoScaleDescription')}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    {((selectedConfig.config as { style: TextStyle }).style
                      .autoScale ?? true)
                      ? t('screens.textStyle.maxFontSize')
                      : t('screens.textStyle.fontSize')}{' '}
                    (px)
                  </Label>
                  <Input
                    type="number"
                    value={
                      (selectedConfig.config as { style: TextStyle }).style
                        .maxFontSize
                    }
                    onChange={(e) => {
                      updateElementStyle({
                        maxFontSize: parseInt(e.target.value) || 24,
                      })
                    }}
                    className="h-8"
                  />
                </div>
                {(selectedConfig.config as { style: TextStyle }).style
                  .autoScale && (
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      {t('screens.textStyle.minFontSize')} (px)
                    </Label>
                    <Input
                      type="number"
                      value={
                        (selectedConfig.config as { style: TextStyle }).style
                          .minFontSize ?? 12
                      }
                      onChange={(e) => {
                        updateElementStyle({
                          minFontSize: parseInt(e.target.value) || 12,
                        })
                      }}
                      className="h-8"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    Color
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={
                        (selectedConfig.config as { style: TextStyle }).style
                          .color
                      }
                      onChange={(e) => {
                        updateElementStyle({ color: e.target.value })
                      }}
                      className="w-10 h-8 rounded cursor-pointer"
                    />
                    <Input
                      value={
                        (selectedConfig.config as { style: TextStyle }).style
                          .color
                      }
                      onChange={(e) => {
                        updateElementStyle({ color: e.target.value })
                      }}
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={
                      (selectedConfig.config as { style: TextStyle }).style.bold
                    }
                    onCheckedChange={(checked) => {
                      updateElementStyle({ bold: !!checked })
                    }}
                    label="Bold"
                  />
                  <Checkbox
                    checked={
                      (selectedConfig.config as { style: TextStyle }).style
                        .italic
                    }
                    onCheckedChange={(checked) => {
                      updateElementStyle({ italic: !!checked })
                    }}
                    label="Italic"
                  />
                  <Checkbox
                    checked={
                      (selectedConfig.config as { style: TextStyle }).style
                        .underline
                    }
                    onCheckedChange={(checked) => {
                      updateElementStyle({ underline: !!checked })
                    }}
                    label="Underline"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    Horizontal Alignment
                  </Label>
                  <div className="flex gap-2 mt-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        className={`flex-1 py-1.5 text-xs font-medium rounded ${
                          (selectedConfig.config as { style: TextStyle }).style
                            .alignment === align
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => {
                          updateElementStyle({ alignment: align })
                        }}
                      >
                        {align.charAt(0).toUpperCase() + align.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    Vertical Alignment
                  </Label>
                  <div className="flex gap-2 mt-1">
                    {(['top', 'middle', 'bottom'] as const).map((align) => (
                      <button
                        key={align}
                        className={`flex-1 py-1.5 text-xs font-medium rounded ${
                          (selectedConfig.config as { style: TextStyle }).style
                            .verticalAlignment === align
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => {
                          updateElementStyle({ verticalAlignment: align })
                        }}
                      >
                        {align.charAt(0).toUpperCase() + align.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    {t('screens.textStyle.lineHeight')}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[
                        (selectedConfig.config as { style: TextStyle }).style
                          .lineHeight ?? 1.3,
                      ]}
                      onValueChange={([value]) => {
                        updateElementStyle({ lineHeight: value })
                      }}
                      min={0.8}
                      max={3}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                      {(
                        (selectedConfig.config as { style: TextStyle }).style
                          .lineHeight ?? 1.3
                      ).toFixed(1)}
                    </span>
                  </div>
                </div>
                <Checkbox
                  checked={
                    (selectedConfig.config as { style: TextStyle }).style
                      .shadow ?? false
                  }
                  onCheckedChange={(checked) => {
                    updateElementStyle({ shadow: !!checked })
                  }}
                  label={t('screens.textStyle.shadow')}
                />

                {/* Line Compression */}
                <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <Checkbox
                    checked={
                      (selectedConfig.config as { style: TextStyle }).style
                        .compressLines ?? false
                    }
                    onCheckedChange={(checked) => {
                      updateElementStyle({ compressLines: !!checked })
                    }}
                    label={t('screens.textStyle.compressLines')}
                  />
                  {(selectedConfig.config as { style: TextStyle }).style
                    .compressLines && (
                    <div>
                      <Label className="text-xs text-gray-500 dark:text-gray-400">
                        {t('screens.textStyle.lineSeparator')}
                      </Label>
                      <Combobox
                        value={
                          (selectedConfig.config as { style: TextStyle }).style
                            .lineSeparator ?? 'space'
                        }
                        onChange={(value) => {
                          updateElementStyle({
                            lineSeparator: value as 'space' | 'dash' | 'pipe',
                          })
                        }}
                        options={LINE_SEPARATORS.map((opt) => ({
                          value: opt.value,
                          label: t(`screens.textStyle.separators.${opt.key}`),
                        }))}
                        className="w-full"
                      />
                    </div>
                  )}
                  <Checkbox
                    checked={
                      (selectedConfig.config as { style: TextStyle }).style
                        .fitLineToWidth ?? false
                    }
                    onCheckedChange={(checked) => {
                      updateElementStyle({ fitLineToWidth: !!checked })
                    }}
                    label={t('screens.textStyle.fitLineToWidth')}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                    {t('screens.textStyle.fitLineToWidthDescription')}
                  </p>
                </div>
              </div>
            </Section>
          )}

          {/* Title Style Section (for nextSlide) */}
          {'labelStyle' in selectedConfig.config &&
            selectedConfig.isNextSlide && (
              <Section title="Title Style" icon={Type}>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      Font Family
                    </Label>
                    <Combobox
                      value={
                        (
                          selectedConfig.config as {
                            labelStyle: TextStyle
                          }
                        ).labelStyle.fontFamily
                      }
                      onChange={(value) => {
                        updateNextSlideStyle('labelStyle', {
                          fontFamily: value,
                        })
                      }}
                      options={FONT_FAMILIES}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            labelStyle: TextStyle
                          }
                        ).labelStyle.autoScale ?? true
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('labelStyle', {
                          autoScale: !!checked,
                        })
                      }}
                      label={t('screens.textStyle.autoScale')}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                      {t('screens.textStyle.autoScaleDescription')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      {((
                        selectedConfig.config as {
                          labelStyle: TextStyle
                        }
                      ).labelStyle.autoScale ?? true)
                        ? t('screens.textStyle.maxFontSize')
                        : t('screens.textStyle.fontSize')}{' '}
                      (px)
                    </Label>
                    <Input
                      type="number"
                      value={
                        (
                          selectedConfig.config as {
                            labelStyle: TextStyle
                          }
                        ).labelStyle.maxFontSize
                      }
                      onChange={(e) => {
                        updateNextSlideStyle('labelStyle', {
                          maxFontSize: parseInt(e.target.value) || 24,
                        })
                      }}
                      className="h-8"
                    />
                  </div>
                  {(
                    selectedConfig.config as {
                      labelStyle: TextStyle
                    }
                  ).labelStyle.autoScale && (
                    <div>
                      <Label className="text-xs text-gray-500 dark:text-gray-400">
                        {t('screens.textStyle.minFontSize')} (px)
                      </Label>
                      <Input
                        type="number"
                        value={
                          (
                            selectedConfig.config as {
                              labelStyle: TextStyle
                            }
                          ).labelStyle.minFontSize ?? 12
                        }
                        onChange={(e) => {
                          updateNextSlideStyle('labelStyle', {
                            minFontSize: parseInt(e.target.value) || 12,
                          })
                        }}
                        className="h-8"
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      Color
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={
                          (
                            selectedConfig.config as {
                              labelStyle: TextStyle
                            }
                          ).labelStyle.color
                        }
                        onChange={(e) => {
                          updateNextSlideStyle('labelStyle', {
                            color: e.target.value,
                          })
                        }}
                        className="w-10 h-8 rounded cursor-pointer"
                      />
                      <Input
                        value={
                          (
                            selectedConfig.config as {
                              labelStyle: TextStyle
                            }
                          ).labelStyle.color
                        }
                        onChange={(e) => {
                          updateNextSlideStyle('labelStyle', {
                            color: e.target.value,
                          })
                        }}
                        className="h-8 flex-1"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            labelStyle: TextStyle
                          }
                        ).labelStyle.bold
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('labelStyle', { bold: !!checked })
                      }}
                      label="Bold"
                    />
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            labelStyle: TextStyle
                          }
                        ).labelStyle.italic
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('labelStyle', {
                          italic: !!checked,
                        })
                      }}
                      label="Italic"
                    />
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            labelStyle: TextStyle
                          }
                        ).labelStyle.underline
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('labelStyle', {
                          underline: !!checked,
                        })
                      }}
                      label="Underline"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      Horizontal Alignment
                    </Label>
                    <div className="flex gap-2 mt-1">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          className={`flex-1 py-1.5 text-xs font-medium rounded ${
                            (
                              selectedConfig.config as {
                                labelStyle: TextStyle
                              }
                            ).labelStyle.alignment === align
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => {
                            updateNextSlideStyle('labelStyle', {
                              alignment: align,
                            })
                          }}
                        >
                          {align.charAt(0).toUpperCase() + align.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      Vertical Alignment
                    </Label>
                    <div className="flex gap-2 mt-1">
                      {(['top', 'middle', 'bottom'] as const).map((align) => (
                        <button
                          key={align}
                          className={`flex-1 py-1.5 text-xs font-medium rounded ${
                            (
                              selectedConfig.config as {
                                labelStyle: TextStyle
                              }
                            ).labelStyle.verticalAlignment === align
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => {
                            updateNextSlideStyle('labelStyle', {
                              verticalAlignment: align,
                            })
                          }}
                        >
                          {align.charAt(0).toUpperCase() + align.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      {t('screens.textStyle.lineHeight')}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[
                          (
                            selectedConfig.config as {
                              labelStyle: TextStyle
                            }
                          ).labelStyle.lineHeight ?? 1.3,
                        ]}
                        onValueChange={([value]) => {
                          updateNextSlideStyle('labelStyle', {
                            lineHeight: value,
                          })
                        }}
                        min={0.8}
                        max={3}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                        {(
                          (
                            selectedConfig.config as {
                              labelStyle: TextStyle
                            }
                          ).labelStyle.lineHeight ?? 1.3
                        ).toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <Checkbox
                    checked={
                      (
                        selectedConfig.config as {
                          labelStyle: TextStyle
                        }
                      ).labelStyle.shadow ?? false
                    }
                    onCheckedChange={(checked) => {
                      updateNextSlideStyle('labelStyle', { shadow: !!checked })
                    }}
                    label={t('screens.textStyle.shadow')}
                  />

                  {/* Line Compression */}
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            labelStyle: TextStyle
                          }
                        ).labelStyle.compressLines ?? false
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('labelStyle', {
                          compressLines: !!checked,
                        })
                      }}
                      label={t('screens.textStyle.compressLines')}
                    />
                    {(
                      selectedConfig.config as {
                        labelStyle: TextStyle
                      }
                    ).labelStyle.compressLines && (
                      <div>
                        <Label className="text-xs text-gray-500 dark:text-gray-400">
                          {t('screens.textStyle.lineSeparator')}
                        </Label>
                        <Combobox
                          value={
                            (
                              selectedConfig.config as {
                                labelStyle: TextStyle
                              }
                            ).labelStyle.lineSeparator ?? 'space'
                          }
                          onChange={(value) => {
                            updateNextSlideStyle('labelStyle', {
                              lineSeparator: value as 'space' | 'dash' | 'pipe',
                            })
                          }}
                          options={LINE_SEPARATORS.map((opt) => ({
                            value: opt.value,
                            label: t(`screens.textStyle.separators.${opt.key}`),
                          }))}
                          className="w-full"
                        />
                      </div>
                    )}
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            labelStyle: TextStyle
                          }
                        ).labelStyle.fitLineToWidth ?? false
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('labelStyle', {
                          fitLineToWidth: !!checked,
                        })
                      }}
                      label={t('screens.textStyle.fitLineToWidth')}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                      {t('screens.textStyle.fitLineToWidthDescription')}
                    </p>
                  </div>
                </div>
              </Section>
            )}

          {/* Content Style Section (for nextSlide) */}
          {'contentStyle' in selectedConfig.config &&
            selectedConfig.isNextSlide && (
              <Section title="Content Style" icon={Type}>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      Font Family
                    </Label>
                    <Combobox
                      value={
                        (
                          selectedConfig.config as {
                            contentStyle: TextStyle
                          }
                        ).contentStyle.fontFamily
                      }
                      onChange={(value) => {
                        updateNextSlideStyle('contentStyle', {
                          fontFamily: value,
                        })
                      }}
                      options={FONT_FAMILIES}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            contentStyle: TextStyle
                          }
                        ).contentStyle.autoScale ?? true
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('contentStyle', {
                          autoScale: !!checked,
                        })
                      }}
                      label={t('screens.textStyle.autoScale')}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                      {t('screens.textStyle.autoScaleDescription')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      {((
                        selectedConfig.config as {
                          contentStyle: TextStyle
                        }
                      ).contentStyle.autoScale ?? true)
                        ? t('screens.textStyle.maxFontSize')
                        : t('screens.textStyle.fontSize')}{' '}
                      (px)
                    </Label>
                    <Input
                      type="number"
                      value={
                        (
                          selectedConfig.config as {
                            contentStyle: TextStyle
                          }
                        ).contentStyle.maxFontSize
                      }
                      onChange={(e) => {
                        updateNextSlideStyle('contentStyle', {
                          maxFontSize: parseInt(e.target.value) || 24,
                        })
                      }}
                      className="h-8"
                    />
                  </div>
                  {(
                    selectedConfig.config as {
                      contentStyle: TextStyle
                    }
                  ).contentStyle.autoScale && (
                    <div>
                      <Label className="text-xs text-gray-500 dark:text-gray-400">
                        {t('screens.textStyle.minFontSize')} (px)
                      </Label>
                      <Input
                        type="number"
                        value={
                          (
                            selectedConfig.config as {
                              contentStyle: TextStyle
                            }
                          ).contentStyle.minFontSize ?? 12
                        }
                        onChange={(e) => {
                          updateNextSlideStyle('contentStyle', {
                            minFontSize: parseInt(e.target.value) || 12,
                          })
                        }}
                        className="h-8"
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      Color
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={
                          (
                            selectedConfig.config as {
                              contentStyle: TextStyle
                            }
                          ).contentStyle.color
                        }
                        onChange={(e) => {
                          updateNextSlideStyle('contentStyle', {
                            color: e.target.value,
                          })
                        }}
                        className="w-10 h-8 rounded cursor-pointer"
                      />
                      <Input
                        value={
                          (
                            selectedConfig.config as {
                              contentStyle: TextStyle
                            }
                          ).contentStyle.color
                        }
                        onChange={(e) => {
                          updateNextSlideStyle('contentStyle', {
                            color: e.target.value,
                          })
                        }}
                        className="h-8 flex-1"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            contentStyle: TextStyle
                          }
                        ).contentStyle.bold
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('contentStyle', {
                          bold: !!checked,
                        })
                      }}
                      label="Bold"
                    />
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            contentStyle: TextStyle
                          }
                        ).contentStyle.italic
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('contentStyle', {
                          italic: !!checked,
                        })
                      }}
                      label="Italic"
                    />
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            contentStyle: TextStyle
                          }
                        ).contentStyle.underline
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('contentStyle', {
                          underline: !!checked,
                        })
                      }}
                      label="Underline"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      Horizontal Alignment
                    </Label>
                    <div className="flex gap-2 mt-1">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          className={`flex-1 py-1.5 text-xs font-medium rounded ${
                            (
                              selectedConfig.config as {
                                contentStyle: TextStyle
                              }
                            ).contentStyle.alignment === align
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => {
                            updateNextSlideStyle('contentStyle', {
                              alignment: align,
                            })
                          }}
                        >
                          {align.charAt(0).toUpperCase() + align.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      Vertical Alignment
                    </Label>
                    <div className="flex gap-2 mt-1">
                      {(['top', 'middle', 'bottom'] as const).map((align) => (
                        <button
                          key={align}
                          className={`flex-1 py-1.5 text-xs font-medium rounded ${
                            (
                              selectedConfig.config as {
                                contentStyle: TextStyle
                              }
                            ).contentStyle.verticalAlignment === align
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => {
                            updateNextSlideStyle('contentStyle', {
                              verticalAlignment: align,
                            })
                          }}
                        >
                          {align.charAt(0).toUpperCase() + align.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      {t('screens.textStyle.lineHeight')}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[
                          (
                            selectedConfig.config as {
                              contentStyle: TextStyle
                            }
                          ).contentStyle.lineHeight ?? 1.3,
                        ]}
                        onValueChange={([value]) => {
                          updateNextSlideStyle('contentStyle', {
                            lineHeight: value,
                          })
                        }}
                        min={0.8}
                        max={3}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                        {(
                          (
                            selectedConfig.config as {
                              contentStyle: TextStyle
                            }
                          ).contentStyle.lineHeight ?? 1.3
                        ).toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <Checkbox
                    checked={
                      (
                        selectedConfig.config as {
                          contentStyle: TextStyle
                        }
                      ).contentStyle.shadow ?? false
                    }
                    onCheckedChange={(checked) => {
                      updateNextSlideStyle('contentStyle', {
                        shadow: !!checked,
                      })
                    }}
                    label={t('screens.textStyle.shadow')}
                  />

                  {/* Line Compression */}
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            contentStyle: TextStyle
                          }
                        ).contentStyle.compressLines ?? false
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('contentStyle', {
                          compressLines: !!checked,
                        })
                      }}
                      label={t('screens.textStyle.compressLines')}
                    />
                    {(
                      selectedConfig.config as {
                        contentStyle: TextStyle
                      }
                    ).contentStyle.compressLines && (
                      <div>
                        <Label className="text-xs text-gray-500 dark:text-gray-400">
                          {t('screens.textStyle.lineSeparator')}
                        </Label>
                        <Combobox
                          value={
                            (
                              selectedConfig.config as {
                                contentStyle: TextStyle
                              }
                            ).contentStyle.lineSeparator ?? 'space'
                          }
                          onChange={(value) => {
                            updateNextSlideStyle('contentStyle', {
                              lineSeparator: value as 'space' | 'dash' | 'pipe',
                            })
                          }}
                          options={LINE_SEPARATORS.map((opt) => ({
                            value: opt.value,
                            label: t(`screens.textStyle.separators.${opt.key}`),
                          }))}
                          className="w-full"
                        />
                      </div>
                    )}
                    <Checkbox
                      checked={
                        (
                          selectedConfig.config as {
                            contentStyle: TextStyle
                          }
                        ).contentStyle.fitLineToWidth ?? false
                      }
                      onCheckedChange={(checked) => {
                        updateNextSlideStyle('contentStyle', {
                          fitLineToWidth: !!checked,
                        })
                      }}
                      label={t('screens.textStyle.fitLineToWidth')}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                      {t('screens.textStyle.fitLineToWidthDescription')}
                    </p>
                  </div>
                </div>
              </Section>
            )}

          {/* Animation Section */}
          {'animationIn' in selectedConfig.config && (
            <Section title="Animation" icon={Film} defaultOpen={false}>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    Animation In
                  </Label>
                  <Combobox
                    value={
                      (
                        selectedConfig.config as {
                          animationIn: AnimationConfig
                        }
                      ).animationIn.type
                    }
                    onChange={(value) => {
                      const newAnim = {
                        ...(
                          selectedConfig.config as {
                            animationIn: AnimationConfig
                          }
                        ).animationIn,
                        type: value,
                      }
                      updateConfig(
                        [...selectedConfig.path, 'animationIn'],
                        newAnim,
                      )
                    }}
                    options={ANIMATION_TYPES}
                    className="w-full mb-2"
                  />
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-gray-500 dark:text-gray-400">
                        Duration (ms)
                      </Label>
                      <Slider
                        value={[
                          (
                            selectedConfig.config as {
                              animationIn: AnimationConfig
                            }
                          ).animationIn.duration,
                        ]}
                        onValueChange={([value]) => {
                          const newAnim = {
                            ...(
                              selectedConfig.config as {
                                animationIn: AnimationConfig
                              }
                            ).animationIn,
                            duration: value,
                          }
                          updateConfig(
                            [...selectedConfig.path, 'animationIn'],
                            newAnim,
                          )
                        }}
                        min={0}
                        max={1000}
                        step={50}
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    {t('screens.animation.slideTransition')}
                  </Label>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                    {t('screens.animation.slideTransitionDescription')}
                  </p>
                  <Combobox
                    value={
                      (
                        selectedConfig.config as {
                          slideTransition?: AnimationConfig
                        }
                      ).slideTransition?.type ?? 'fade'
                    }
                    onChange={(value) => {
                      const currentTransition =
                        (
                          selectedConfig.config as {
                            slideTransition?: AnimationConfig
                          }
                        ).slideTransition ?? DEFAULT_SLIDE_TRANSITION
                      const newAnim = {
                        ...currentTransition,
                        type: value,
                      }
                      updateConfig(
                        [...selectedConfig.path, 'slideTransition'],
                        newAnim,
                      )
                    }}
                    options={ANIMATION_TYPES}
                    className="w-full mb-2"
                  />
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-gray-500 dark:text-gray-400">
                        Duration (ms)
                      </Label>
                      <Slider
                        value={[
                          (
                            selectedConfig.config as {
                              slideTransition?: AnimationConfig
                            }
                          ).slideTransition?.duration ?? 250,
                        ]}
                        onValueChange={([value]) => {
                          const currentTransition =
                            (
                              selectedConfig.config as {
                                slideTransition?: AnimationConfig
                              }
                            ).slideTransition ?? DEFAULT_SLIDE_TRANSITION
                          const newAnim = {
                            ...currentTransition,
                            duration: value,
                          }
                          updateConfig(
                            [...selectedConfig.path, 'slideTransition'],
                            newAnim,
                          )
                        }}
                        min={0}
                        max={1000}
                        step={50}
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    Animation Out
                  </Label>
                  <Combobox
                    value={
                      (
                        selectedConfig.config as {
                          animationOut: AnimationConfig
                        }
                      ).animationOut.type
                    }
                    onChange={(value) => {
                      const newAnim = {
                        ...(
                          selectedConfig.config as {
                            animationOut: AnimationConfig
                          }
                        ).animationOut,
                        type: value,
                      }
                      updateConfig(
                        [...selectedConfig.path, 'animationOut'],
                        newAnim,
                      )
                    }}
                    options={ANIMATION_TYPES}
                    className="w-full mb-2"
                  />
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-gray-500 dark:text-gray-400">
                        Duration (ms)
                      </Label>
                      <Slider
                        value={[
                          (
                            selectedConfig.config as {
                              animationOut: AnimationConfig
                            }
                          ).animationOut.duration,
                        ]}
                        onValueChange={([value]) => {
                          const newAnim = {
                            ...(
                              selectedConfig.config as {
                                animationOut: AnimationConfig
                              }
                            ).animationOut,
                            duration: value,
                          }
                          updateConfig(
                            [...selectedConfig.path, 'animationOut'],
                            newAnim,
                          )
                        }}
                        min={0}
                        max={1000}
                        step={50}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Clock-specific Settings */}
          {selectedElement?.type === 'clock' && selectedConfig?.isClock && (
            <Section title="Clock Settings" icon={Clock}>
              <div className="space-y-3">
                <Checkbox
                  checked={
                    (selectedConfig.config as ClockElementConfig).showSeconds
                  }
                  onCheckedChange={(checked) => {
                    onUpdateGlobalSettings({
                      ...screen.globalSettings,
                      clockConfig: {
                        ...screen.globalSettings.clockConfig!,
                        showSeconds: !!checked,
                      },
                    })
                  }}
                  label="Show seconds"
                />
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    Format
                  </Label>
                  <div className="flex gap-2 mt-1">
                    {(['24h', '12h'] as const).map((format) => (
                      <button
                        key={format}
                        className={`flex-1 py-1.5 text-xs font-medium rounded ${
                          (selectedConfig.config as ClockElementConfig)
                            .format === format
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => {
                          onUpdateGlobalSettings({
                            ...screen.globalSettings,
                            clockConfig: {
                              ...screen.globalSettings.clockConfig!,
                              format,
                            },
                          })
                        }}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Preview Text Section */}
          {'style' in selectedConfig.config && (
            <Section
              title={t('screens.editor.previewText')}
              icon={Eye}
              defaultOpen={false}
            >
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('screens.editor.previewTextDescription')}
                </p>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    {t('screens.editor.customPreviewText')}
                  </Label>
                  <textarea
                    className="w-full h-24 px-3 py-2 text-sm border rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('screens.editor.previewTextPlaceholder')}
                    value={(() => {
                      if (!selectedElement || !previewTexts) return ''
                      switch (selectedElement.type) {
                        case 'mainText':
                        case 'contentText':
                          return previewTexts.main ?? ''
                        case 'referenceText':
                          return previewTexts.reference ?? ''
                        case 'personLabel':
                          return previewTexts.person ?? ''
                        default:
                          return ''
                      }
                    })()}
                    onChange={(e) => {
                      if (!selectedElement || !onSetPreviewText) return
                      switch (selectedElement.type) {
                        case 'mainText':
                        case 'contentText':
                          onSetPreviewText('main', e.target.value)
                          break
                        case 'referenceText':
                          onSetPreviewText('reference', e.target.value)
                          break
                        case 'personLabel':
                          onSetPreviewText('person', e.target.value)
                          break
                      }
                    }}
                  />
                </div>
                {previewTexts &&
                  (previewTexts.main ||
                    previewTexts.reference ||
                    previewTexts.person) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onResetPreviewTexts?.()}
                    >
                      {t('screens.editor.resetPreviewText')}
                    </Button>
                  )}
              </div>
            </Section>
          )}
        </>
      ) : (
        // Global configuration (when nothing selected)
        <>
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200">
              Screen Settings
            </h3>
          </div>

          {/* Screen Size */}
          <Section title="Screen Size" icon={Settings}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">
                  Width (px)
                </Label>
                <Input
                  type="number"
                  value={screen.width}
                  min={100}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    if (!isNaN(value) && value >= 100) {
                      onUpdateScreenDimensions(value, screen.height)
                    }
                  }}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">
                  Height (px)
                </Label>
                <Input
                  type="number"
                  value={screen.height}
                  min={100}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    if (!isNaN(value) && value >= 100) {
                      onUpdateScreenDimensions(screen.width, value)
                    }
                  }}
                  className="h-8"
                />
              </div>
            </div>
          </Section>

          {/* Background */}
          <Section title="Background" icon={Palette}>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">
                  Type
                </Label>
                <Combobox
                  value={config.background.type}
                  onChange={(value) => {
                    onUpdateContentConfig(contentType, {
                      ...config,
                      background: {
                        ...config.background,
                        type: value as ScreenBackgroundConfig['type'],
                      },
                    })
                  }}
                  options={BACKGROUND_TYPES}
                  className="w-full"
                />
              </div>
              {config.background.type === 'color' && (
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    Color
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.background.color ?? '#000000'}
                      onChange={(e) => {
                        onUpdateContentConfig(contentType, {
                          ...config,
                          background: {
                            ...config.background,
                            color: e.target.value,
                          },
                        })
                      }}
                      className="w-10 h-8 rounded cursor-pointer"
                    />
                    <Input
                      value={config.background.color ?? '#000000'}
                      onChange={(e) => {
                        onUpdateContentConfig(contentType, {
                          ...config,
                          background: {
                            ...config.background,
                            color: e.target.value,
                          },
                        })
                      }}
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
              )}
              {(config.background.type === 'image' ||
                config.background.type === 'video') && (
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    URL
                  </Label>
                  <Input
                    value={
                      config.background.type === 'image'
                        ? (config.background.imageUrl ?? '')
                        : (config.background.videoUrl ?? '')
                    }
                    onChange={(e) => {
                      onUpdateContentConfig(contentType, {
                        ...config,
                        background: {
                          ...config.background,
                          ...(config.background.type === 'image'
                            ? { imageUrl: e.target.value }
                            : { videoUrl: e.target.value }),
                        },
                      })
                    }}
                    placeholder="Enter URL..."
                    className="h-8"
                  />
                </div>
              )}
            </div>
          </Section>

          {/* Bible Options - only show for bible content types */}
          {(contentType === 'bible' || contentType === 'bible_passage') && (
            <Section
              title={t('screens.bibleOptions.title')}
              icon={Settings}
              defaultOpen={false}
            >
              <div className="space-y-3">
                <Checkbox
                  checked={
                    (config as BibleContentConfig).includeReferenceInContent ??
                    false
                  }
                  onCheckedChange={(checked) => {
                    const bibleConfig = config as BibleContentConfig
                    onUpdateContentConfig(contentType, {
                      ...bibleConfig,
                      includeReferenceInContent: !!checked,
                    })
                  }}
                  label={t('screens.bibleOptions.includeReferenceInContent')}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                  {t(
                    'screens.bibleOptions.includeReferenceInContentDescription',
                  )}
                </p>
              </div>
            </Section>
          )}

          {/* Clock Settings - per-content-type enable with shared config */}
          <Section title="Clock" icon={Clock} defaultOpen={false}>
            <div className="space-y-3">
              {/* Per-content-type enable toggle */}
              <Checkbox
                checked={
                  'clockEnabled' in config
                    ? (config.clockEnabled ?? false)
                    : false
                }
                onCheckedChange={(checked) => {
                  onUpdateContentConfig(contentType, {
                    ...config,
                    clockEnabled: !!checked,
                  })
                }}
                label={t('screens.clock.enableForSlideType')}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                {t('screens.clock.enableDescription')}
              </p>

              {/* Shared clock configuration - always visible for editing */}
              {screen.globalSettings.clockConfig && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                    <Label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">
                      {t('screens.clock.sharedSettings')}
                    </Label>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">
                      {t('screens.clock.format')}
                    </Label>
                    <div className="flex gap-2 mt-1">
                      {(['24h', '12h'] as const).map((format) => (
                        <button
                          key={format}
                          className={`flex-1 py-1.5 text-xs font-medium rounded ${
                            screen.globalSettings.clockConfig?.format === format
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => {
                            onUpdateGlobalSettings({
                              ...screen.globalSettings,
                              clockConfig: {
                                ...screen.globalSettings.clockConfig!,
                                format,
                              },
                            })
                          }}
                        >
                          {format}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Checkbox
                    checked={screen.globalSettings.clockConfig.showSeconds}
                    onCheckedChange={(checked) => {
                      onUpdateGlobalSettings({
                        ...screen.globalSettings,
                        clockConfig: {
                          ...screen.globalSettings.clockConfig!,
                          showSeconds: !!checked,
                        },
                      })
                    }}
                    label={t('screens.clock.showSeconds')}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                    {t('screens.clock.positionHint')}
                  </p>
                </>
              )}
            </div>
          </Section>

          {/* Next Slide Section Settings */}
          <Section
            title={t('screens.nextSlide.title')}
            icon={Eye}
            defaultOpen={false}
          >
            <div className="space-y-3">
              <Checkbox
                checked={screen.nextSlideConfig?.enabled ?? false}
                onCheckedChange={(checked) => {
                  if (screen.nextSlideConfig) {
                    onUpdateNextSlideConfig({
                      ...screen.nextSlideConfig,
                      enabled: !!checked,
                    })
                  }
                }}
                label={t('screens.nextSlide.enable')}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                {t('screens.nextSlide.description')}
              </p>
              {screen.nextSlideConfig?.enabled && (
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    {t('screens.nextSlide.labelText')}
                  </Label>
                  <Input
                    value={screen.nextSlideConfig.labelText}
                    onChange={(e) => {
                      onUpdateNextSlideConfig({
                        ...screen.nextSlideConfig!,
                        labelText: e.target.value,
                      })
                    }}
                    placeholder="Urmeaza:"
                    className="h-8"
                  />
                </div>
              )}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

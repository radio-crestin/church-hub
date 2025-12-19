import {
  ChevronDown,
  ChevronRight,
  Clock,
  Film,
  Move,
  Palette,
  Settings,
  Type,
} from 'lucide-react'
import { useState } from 'react'

import { Checkbox } from '~/ui/checkbox/Checkbox'
import { Combobox } from '~/ui/combobox/Combobox'
import { Input } from '~/ui/input/Input'
import { Label } from '~/ui/label/Label'
import { Slider } from '~/ui/slider/Slider'
import { ConstraintControls } from './ConstraintControls'
import type { SelectedElement } from './hooks/useEditorState'
import type {
  AnimationConfig,
  ClockElementConfig,
  Constraints,
  ContentType,
  ContentTypeConfig,
  NextSlideSectionConfig,
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
  onUpdateContentConfig: (
    contentType: ContentType,
    config: ContentTypeConfig,
  ) => void
  onUpdateNextSlideConfig: (config: NextSlideSectionConfig) => void
  onUpdateGlobalSettings: (settings: ScreenGlobalSettings) => void
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

export function ScreenEditorSidebar({
  screen,
  contentType,
  selectedElement,
  onUpdateContentConfig,
  onUpdateNextSlideConfig,
  onUpdateGlobalSettings,
}: ScreenEditorSidebarProps) {
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

  // Get the currently selected element's config
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
        return 'referenceText' in config
          ? { path: ['referenceText'], config: config.referenceText }
          : null
      case 'personLabel':
        return 'personLabel' in config
          ? { path: ['personLabel'], config: config.personLabel }
          : null
      case 'clock':
        return 'clock' in config && config.clock
          ? { path: ['clock'], config: config.clock }
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
          {'constraints' in selectedConfig.config &&
            'size' in selectedConfig.config && (
              <Section title="Position" icon={Move}>
                <ConstraintControls
                  constraints={
                    (selectedConfig.config as { constraints: Constraints })
                      .constraints
                  }
                  size={(selectedConfig.config as { size: SizeWithUnits }).size}
                  onChange={(newConstraints, newSize) => {
                    if (selectedConfig.isNextSlide) {
                      onUpdateNextSlideConfig({
                        ...screen.nextSlideConfig!,
                        constraints: newConstraints,
                        size: newSize,
                      })
                    } else {
                      updateConfig(
                        [...selectedConfig.path, 'constraints'],
                        newConstraints,
                      )
                      updateConfig([...selectedConfig.path, 'size'], newSize)
                    }
                  }}
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
                      const newStyle = {
                        ...(selectedConfig.config as { style: TextStyle })
                          .style,
                        fontFamily: value,
                      }
                      if (selectedConfig.isNextSlide) {
                        // Handle next slide style updates
                      } else {
                        updateConfig(
                          [...selectedConfig.path, 'style'],
                          newStyle,
                        )
                      }
                    }}
                    options={FONT_FAMILIES}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    Max Font Size (px)
                  </Label>
                  <Input
                    type="number"
                    value={
                      (selectedConfig.config as { style: TextStyle }).style
                        .maxFontSize
                    }
                    onChange={(e) => {
                      const newStyle = {
                        ...(selectedConfig.config as { style: TextStyle })
                          .style,
                        maxFontSize: parseInt(e.target.value) || 24,
                      }
                      updateConfig([...selectedConfig.path, 'style'], newStyle)
                    }}
                    className="h-8"
                  />
                </div>
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
                        const newStyle = {
                          ...(selectedConfig.config as { style: TextStyle })
                            .style,
                          color: e.target.value,
                        }
                        updateConfig(
                          [...selectedConfig.path, 'style'],
                          newStyle,
                        )
                      }}
                      className="w-10 h-8 rounded cursor-pointer"
                    />
                    <Input
                      value={
                        (selectedConfig.config as { style: TextStyle }).style
                          .color
                      }
                      onChange={(e) => {
                        const newStyle = {
                          ...(selectedConfig.config as { style: TextStyle })
                            .style,
                          color: e.target.value,
                        }
                        updateConfig(
                          [...selectedConfig.path, 'style'],
                          newStyle,
                        )
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
                      const newStyle = {
                        ...(selectedConfig.config as { style: TextStyle })
                          .style,
                        bold: checked,
                      }
                      updateConfig([...selectedConfig.path, 'style'], newStyle)
                    }}
                    label="Bold"
                  />
                  <Checkbox
                    checked={
                      (selectedConfig.config as { style: TextStyle }).style
                        .italic
                    }
                    onCheckedChange={(checked) => {
                      const newStyle = {
                        ...(selectedConfig.config as { style: TextStyle })
                          .style,
                        italic: checked,
                      }
                      updateConfig([...selectedConfig.path, 'style'], newStyle)
                    }}
                    label="Italic"
                  />
                  <Checkbox
                    checked={
                      (selectedConfig.config as { style: TextStyle }).style
                        .underline
                    }
                    onCheckedChange={(checked) => {
                      const newStyle = {
                        ...(selectedConfig.config as { style: TextStyle })
                          .style,
                        underline: checked,
                      }
                      updateConfig([...selectedConfig.path, 'style'], newStyle)
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
                          const newStyle = {
                            ...(selectedConfig.config as { style: TextStyle })
                              .style,
                            alignment: align,
                          }
                          updateConfig(
                            [...selectedConfig.path, 'style'],
                            newStyle,
                          )
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
                          const newStyle = {
                            ...(selectedConfig.config as { style: TextStyle })
                              .style,
                            verticalAlignment: align,
                          }
                          updateConfig(
                            [...selectedConfig.path, 'style'],
                            newStyle,
                          )
                        }}
                      >
                        {align.charAt(0).toUpperCase() + align.slice(1)}
                      </button>
                    ))}
                  </div>
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
                <div>
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
          {selectedElement?.type === 'clock' && (
            <Section title="Clock Settings" icon={Clock}>
              <div className="space-y-3">
                <Checkbox
                  checked={
                    (selectedConfig.config as ClockElementConfig).showSeconds
                  }
                  onCheckedChange={(checked) => {
                    updateConfig(
                      [...selectedConfig.path, 'showSeconds'],
                      !!checked,
                    )
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
                          updateConfig(
                            [...selectedConfig.path, 'format'],
                            format,
                          )
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
                  disabled
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
                  disabled
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

          {/* Clock Settings */}
          <Section title="Clock" icon={Type} defaultOpen={false}>
            <div className="space-y-3">
              <Checkbox
                checked={screen.globalSettings.clockEnabled}
                onCheckedChange={(checked) => {
                  onUpdateGlobalSettings({
                    ...screen.globalSettings,
                    clockEnabled: !!checked,
                  })
                }}
                label="Show clock on all slides"
              />
              {screen.globalSettings.clockEnabled &&
                screen.globalSettings.clockConfig && (
                  <>
                    <div>
                      <Label className="text-xs text-gray-500 dark:text-gray-400">
                        Format
                      </Label>
                      <div className="flex gap-2 mt-1">
                        {(['24h', '12h'] as const).map((format) => (
                          <button
                            key={format}
                            className={`flex-1 py-1.5 text-xs font-medium rounded ${
                              screen.globalSettings.clockConfig?.format ===
                              format
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
                      label="Show seconds"
                    />
                  </>
                )}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

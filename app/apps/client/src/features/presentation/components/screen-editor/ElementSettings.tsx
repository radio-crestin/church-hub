import { ArrowLeft, Clock, Eye, Film, Move, Type } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import { Checkbox } from '~/ui/checkbox/Checkbox'
import { Label } from '~/ui/label/Label'
import { AnimationControls } from './AnimationControls'
import { ConstraintControls } from './ConstraintControls'
import { type ElementConfig, getElementConfig } from './getElementConfig'
import type {
  PreviewTextKey,
  PreviewTexts,
  SelectedElement,
} from './hooks/useEditorState'
import { PositionTools } from './position/PositionTools'
import { SegmentedControl } from './SegmentedControl'
import { SettingsSection } from './SettingsSection'
import { TextStyleControls } from './TextStyleControls'
import type {
  ContentTypeConfig,
  NextSlideSectionConfig,
  ScreenGlobalSettings,
  ScreenWithConfigs,
  SizeWithUnits,
} from '../../types'

const DEFAULT_SIZE: SizeWithUnits = {
  width: 10,
  widthUnit: '%',
  height: 5,
  heightUnit: '%',
}

/** Where the preview text of each element is kept while editing. */
const PREVIEW_TEXT_KEYS: Partial<
  Record<NonNullable<SelectedElement>['type'], PreviewTextKey>
> = {
  mainText: 'main',
  contentText: 'main',
  referenceText: 'reference',
  personLabel: 'person',
}

/**
 * Elements whose transitions show even when none is saved: older configs
 * lack them, and the screen plays the factory ones.
 */
const ALWAYS_ANIMATED = new Set([
  'referenceText',
  'songKey',
  'amen',
  'songTitle',
  'personLabel',
])

interface ElementSettingsProps {
  screen: ScreenWithConfigs
  config: ContentTypeConfig
  element: NonNullable<SelectedElement>
  previewTexts?: PreviewTexts
  onSetPreviewText?: (key: PreviewTextKey, text: string) => void
  onResetPreviewTexts?: () => void
  /** Writes values at paths of the slide type's config, in one change. */
  onUpdateConfig: (updates: Array<{ path: string[]; value: unknown }>) => void
  onUpdateNextSlideConfig: (config: Partial<NextSlideSectionConfig>) => void
  onUpdateGlobalSettings: (settings: ScreenGlobalSettings) => void
  onBack: () => void
  portalContainer?: HTMLElement | null
}

/**
 * The settings of the element picked on the preview: its text, place,
 * transitions and visibility. The clock and the next-slide box belong to the
 * whole screen; every other element to the slide type being edited.
 */
export function ElementSettings({
  screen,
  config,
  element,
  previewTexts,
  onSetPreviewText,
  onResetPreviewTexts,
  onUpdateConfig,
  onUpdateNextSlideConfig,
  onUpdateGlobalSettings,
  onBack,
  portalContainer,
}: ElementSettingsProps) {
  const { t } = useTranslation('presentation')
  const isClock = element.type === 'clock'
  const isNextSlide = element.type === 'nextSlide'
  const clockConfig = screen.globalSettings.clockConfig
  const elementConfig = getElementConfig(screen, config, element.type)

  if (!elementConfig) return null

  // One change to the element, wherever its config lives.
  const update = (
    changes: Partial<ElementConfig> & Record<string, unknown>,
  ) => {
    if (isNextSlide) {
      onUpdateNextSlideConfig({ ...screen.nextSlideConfig!, ...changes })
    } else if (isClock) {
      onUpdateGlobalSettings({
        ...screen.globalSettings,
        clockConfig: { ...clockConfig!, ...changes },
      })
    } else {
      onUpdateConfig(
        Object.entries(changes).map(([key, value]) => ({
          path: [element.type, key],
          value,
        })),
      )
    }
  }

  const previewTextKey = PREVIEW_TEXT_KEYS[element.type]
  // The "Amin" element has no underlying song data, so its text is a saved
  // config value (the operator's custom label, default "Amin!"), not a
  // preview-only override: it drives the projected output too.
  const previewText =
    element.type === 'amen'
      ? (elementConfig.text ?? '')
      : previewTextKey
        ? (previewTexts?.[previewTextKey] ?? '')
        : ''
  const setPreviewText = (text: string) => {
    if (element.type === 'amen') update({ text: text || undefined })
    else if (previewTextKey) onSetPreviewText?.(previewTextKey, text)
  }
  const hasPreviewTexts =
    !!previewTexts &&
    !!(previewTexts.main || previewTexts.reference || previewTexts.person)

  return (
    <div data-testid="screen-editor-element-settings">
      <div className="flex items-center gap-2 px-2 py-2 border-b border-line bg-field">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          title={t('screens.editor.backToScreen')}
          aria-label={t('screens.editor.backToScreen')}
          data-testid="screen-editor-back"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </Button>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-fg truncate">
            {t(`screens.elements.${element.type}`)}
          </h3>
          <p className="text-xs text-fg-hint">
            {isClock || isNextSlide
              ? t('screens.editor.appliesToScreen')
              : t('screens.editor.appliesToSlideType')}
          </p>
        </div>
      </div>

      {elementConfig.constraints && (
        <div className="px-4 py-3 border-b border-line">
          <Checkbox
            checked={elementConfig.hidden ?? false}
            onCheckedChange={(checked) => update({ hidden: !!checked })}
            label={t('screens.visibility.hideElement')}
          />
        </div>
      )}

      {element.type === 'songTitle' && (
        <div className="px-4 py-3 border-b border-line">
          <Checkbox
            checked={elementConfig.showNumber ?? false}
            onCheckedChange={(checked) => update({ showNumber: !!checked })}
            label={t('screens.songTitle.showNumber')}
          />
        </div>
      )}

      {elementConfig.style && (
        <SettingsSection title={t('screens.panels.textStyle')} icon={Type}>
          <TextStyleControls
            style={elementConfig.style}
            onChange={(changes) =>
              update({ style: { ...elementConfig.style!, ...changes } })
            }
            portalContainer={portalContainer}
          />
        </SettingsSection>
      )}

      {isNextSlide &&
        (['labelStyle', 'contentStyle'] as const).map((styleKey) => (
          <SettingsSection
            key={styleKey}
            title={t(
              `screens.sections.${styleKey === 'labelStyle' ? 'titleStyle' : 'contentStyle'}`,
            )}
            icon={Type}
          >
            <TextStyleControls
              style={elementConfig[styleKey]!}
              onChange={(changes) =>
                update({
                  [styleKey]: { ...elementConfig[styleKey]!, ...changes },
                })
              }
              portalContainer={portalContainer}
            />
          </SettingsSection>
        ))}

      {isClock && (
        <SettingsSection
          title={t('screens.sections.clockSettings')}
          icon={Clock}
        >
          <Checkbox
            checked={elementConfig.showSeconds ?? false}
            onCheckedChange={(checked) => update({ showSeconds: !!checked })}
            label={t('screens.clock.showSeconds')}
          />
          <div>
            <Label className="text-xs text-fg-label">
              {t('screens.clock.format')}
            </Label>
            <SegmentedControl
              options={[
                { value: '24h', label: '24h' },
                { value: '12h', label: '12h' },
              ]}
              value={elementConfig.format}
              onChange={(format) => update({ format })}
            />
          </div>
        </SettingsSection>
      )}

      {elementConfig.constraints && (
        <SettingsSection title={t('screens.sections.position')} icon={Move}>
          <PositionTools
            constraints={elementConfig.constraints}
            size={elementConfig.size ?? DEFAULT_SIZE}
            screenWidth={screen.width}
            screenHeight={screen.height}
            locked={elementConfig.locked ?? false}
            onPaste={(constraints, size) => update({ constraints, size })}
            onLockedChange={(locked) => update({ locked })}
          />
          {elementConfig.locked && (
            <p className="text-xs text-fg-hint">
              {t('screens.position.lockedDescription')}
            </p>
          )}
          {/* A locked element's place can't be edited until it is unlocked */}
          <fieldset
            disabled={elementConfig.locked ?? false}
            className="min-w-0 disabled:opacity-50"
          >
            <ConstraintControls
              constraints={elementConfig.constraints}
              size={elementConfig.size ?? DEFAULT_SIZE}
              screenWidth={screen.width}
              screenHeight={screen.height}
              onChange={(constraints, size) => update({ constraints, size })}
            />
          </fieldset>
        </SettingsSection>
      )}

      {('animationIn' in elementConfig ||
        ALWAYS_ANIMATED.has(element.type)) && (
        <SettingsSection
          title={t('screens.panels.animation')}
          icon={Film}
          defaultOpen={false}
        >
          <AnimationControls
            config={elementConfig}
            onChange={(key, animation) => update({ [key]: animation })}
            portalContainer={portalContainer}
          />
        </SettingsSection>
      )}

      {elementConfig.style && (
        <SettingsSection
          title={t('screens.editor.previewText')}
          icon={Eye}
          defaultOpen={false}
        >
          <p className="text-xs text-fg-hint">
            {t('screens.editor.previewTextDescription')}
          </p>
          <div>
            <Label className="text-xs text-fg-label">
              {t('screens.editor.customPreviewText')}
            </Label>
            <textarea
              className="w-full h-24 px-3 py-2 text-[13px] rounded-[10px] bg-field text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
              placeholder={t('screens.editor.previewTextPlaceholder')}
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
            />
          </div>
          {hasPreviewTexts && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResetPreviewTexts?.()}
            >
              {t('screens.editor.resetPreviewText')}
            </Button>
          )}
        </SettingsSection>
      )}
    </div>
  )
}

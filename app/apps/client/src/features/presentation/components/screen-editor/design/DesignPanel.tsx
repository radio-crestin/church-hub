import { Clapperboard, Image, Palette, Type } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { BackgroundEditor } from '~/features/background-media'
import { Combobox } from '~/ui/combobox/Combobox'
import { Label } from '~/ui/label/Label'
import { Slider } from '~/ui/slider/Slider'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import {
  applyThemeDesign,
  readThemeDesign,
  type ThemeDesignChange,
} from './themeDesign'
import type { AnimationType, ScreenWithConfigs } from '../../../types'
import { FONT_FAMILY_OPTIONS } from '../../../utils/fontFamilyOptions'
import { ANIMATION_TYPES } from '../AnimationControls'
import { SettingsSection } from '../SettingsSection'

interface DesignPanelProps {
  screen: ScreenWithConfigs
  onChange: (update: (screen: ScreenWithConfigs) => ScreenWithConfigs) => void
  portalContainer?: HTMLElement | null
}

function ColorField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string
  value: string
  onChange: (color: string) => void
  testId: string
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] text-fg-body">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-testid={testId}
        className="h-8 w-14 cursor-pointer rounded-lg border border-line-strong bg-field"
      />
    </label>
  )
}

/**
 * The theme's design, like PowerPoint's Design tab: colours, fonts,
 * background and transition, each changed on every slide at once.
 */
export function DesignPanel({
  screen,
  onChange,
  portalContainer,
}: DesignPanelProps) {
  const { t } = useTranslation('presentation')
  const design = readThemeDesign(screen)
  const apply = (change: ThemeDesignChange) =>
    onChange((current) => applyThemeDesign(current, change))

  const fonts = useMemo(
    () =>
      FONT_FAMILY_OPTIONS.map((option) =>
        option.value === 'system-ui'
          ? { ...option, label: t('screens.textStyle.systemDefault') }
          : option,
      ),
    [t],
  )
  const transitions = ANIMATION_TYPES.map(({ value, labelKey }) => ({
    value,
    label: t(labelKey),
  }))

  return (
    <div data-testid="theme-design-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold text-fg">
          {t('templates.design.title')}
        </h2>
        <p className="mt-0.5 text-xs text-fg-hint">
          {t('templates.design.description')}
        </p>
      </div>

      <SettingsSection title={t('templates.design.colors')} icon={Palette}>
        <ColorField
          label={t('templates.design.textColor')}
          value={design.textColor}
          onChange={(textColor) => apply({ textColor })}
          testId="theme-design-text-color"
        />
        <ColorField
          label={t('templates.design.accentColor')}
          value={design.accentColor}
          onChange={(accentColor) => apply({ accentColor })}
          testId="theme-design-accent-color"
        />
        <SwitchRow
          label={t('templates.design.shadow')}
          description={t('templates.design.shadowDescription')}
          checked={design.shadow}
          onCheckedChange={(shadow) => apply({ shadow })}
          testId="theme-design-shadow"
        />
      </SettingsSection>

      <SettingsSection title={t('templates.design.fonts')} icon={Type}>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs">
              {t('templates.design.textFont')}
            </Label>
            <Combobox
              value={design.textFont}
              onChange={(value) => value && apply({ textFont: String(value) })}
              options={fonts}
              allowClear={false}
              portalContainer={portalContainer}
              testId="theme-design-text-font"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">
              {t('templates.design.accentFont')}
            </Label>
            <Combobox
              value={design.accentFont}
              onChange={(value) =>
                value && apply({ accentFont: String(value) })
              }
              options={fonts}
              allowClear={false}
              portalContainer={portalContainer}
              testId="theme-design-accent-font"
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t('templates.design.background')} icon={Image}>
        <BackgroundEditor
          value={design.background}
          onChange={(background) => background && apply({ background })}
          portalContainer={portalContainer}
        />
      </SettingsSection>

      <SettingsSection
        title={t('templates.design.transition')}
        icon={Clapperboard}
      >
        <div className="space-y-3">
          <Combobox
            value={design.transition}
            onChange={(value) =>
              value && apply({ transition: value as AnimationType })
            }
            options={transitions}
            allowClear={false}
            portalContainer={portalContainer}
            testId="theme-design-transition"
          />
          <div>
            <Label className="mb-1 block text-xs">
              {t('templates.design.duration')}
            </Label>
            <Slider
              value={[design.transitionMs]}
              onValueChange={([transitionMs]) => apply({ transitionMs })}
              min={0}
              max={2000}
              step={50}
              showValue
              formatValue={(value) => `${value} ms`}
            />
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}

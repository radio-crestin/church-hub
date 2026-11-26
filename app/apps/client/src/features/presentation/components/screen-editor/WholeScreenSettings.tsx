import { Clock, Eye, Ruler } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Input } from '~/ui/input/Input'
import { Label } from '~/ui/label/Label'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { SegmentedControl } from './SegmentedControl'
import { SettingsSection } from './SettingsSection'
import { SidebarGroupHeading } from './SidebarGroupHeading'
import type {
  ClockElementConfig,
  NextSlideSectionConfig,
  ScreenGlobalSettings,
  ScreenWithConfigs,
} from '../../types'

const MIN_DIMENSION = 100

interface WholeScreenSettingsProps {
  screen: ScreenWithConfigs
  onUpdateNextSlideConfig: (config: Partial<NextSlideSectionConfig>) => void
  onUpdateGlobalSettings: (settings: ScreenGlobalSettings) => void
  onUpdateScreenDimensions: (width: number, height: number) => void
}

/**
 * What every slide type of the screen shares: the clock's look, the
 * next-slide box, the sound of a shared screen and the screen's size.
 */
export function WholeScreenSettings({
  screen,
  onUpdateNextSlideConfig,
  onUpdateGlobalSettings,
  onUpdateScreenDimensions,
}: WholeScreenSettingsProps) {
  const { t } = useTranslation('presentation')
  const { globalSettings, nextSlideConfig } = screen
  const clockConfig = globalSettings.clockConfig
  const updateClock = (changes: Partial<ClockElementConfig>) =>
    onUpdateGlobalSettings({
      ...globalSettings,
      clockConfig: { ...clockConfig!, ...changes },
    })
  const setDimension = (raw: string, apply: (value: number) => void) => {
    const value = parseInt(raw, 10)
    if (!Number.isNaN(value) && value >= MIN_DIMENSION) apply(value)
  }

  return (
    <div data-testid="screen-editor-whole-screen-settings">
      <SidebarGroupHeading
        title={t('screens.editor.wholeScreen')}
        description={t('screens.editor.wholeScreenDescription')}
      />

      {clockConfig && (
        <SettingsSection
          title={t('screens.sections.clockSettings')}
          icon={Clock}
          defaultOpen={false}
        >
          <div>
            <Label className="text-xs text-fg-label">
              {t('screens.clock.format')}
            </Label>
            <SegmentedControl
              options={[
                { value: '24h', label: '24h' },
                { value: '12h', label: '12h' },
              ]}
              value={clockConfig.format}
              onChange={(format) => updateClock({ format })}
            />
          </div>
          <SwitchRow
            label={t('screens.clock.showSeconds')}
            description={t('screens.clock.positionHint')}
            checked={clockConfig.showSeconds}
            onCheckedChange={(showSeconds) => updateClock({ showSeconds })}
          />
        </SettingsSection>
      )}

      <SettingsSection
        title={t('screens.nextSlide.title')}
        icon={Eye}
        defaultOpen={false}
      >
        <SwitchRow
          label={t('screens.nextSlide.enable')}
          description={t('screens.nextSlide.description')}
          checked={nextSlideConfig?.enabled ?? false}
          onCheckedChange={(enabled) => {
            if (nextSlideConfig)
              onUpdateNextSlideConfig({ ...nextSlideConfig, enabled })
          }}
          disabled={!nextSlideConfig}
        />
        {nextSlideConfig?.enabled && (
          <div>
            <Label className="text-xs text-fg-label">
              {t('screens.nextSlide.labelText')}
            </Label>
            <Input
              value={nextSlideConfig.labelText}
              onChange={(e) =>
                onUpdateNextSlideConfig({
                  ...nextSlideConfig,
                  labelText: e.target.value,
                })
              }
              placeholder={t('screens.nextSlide.labelPlaceholder')}
              className="h-8"
            />
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title={t('screens.general.screenSize')}
        icon={Ruler}
        defaultOpen={false}
      >
        <p className="text-xs text-fg-hint">
          {t('screens.general.screenSizeDescription')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-fg-label">
              {t('screens.general.widthPx')}
            </Label>
            <Input
              type="number"
              value={screen.width}
              min={MIN_DIMENSION}
              onChange={(e) =>
                setDimension(e.target.value, (width) =>
                  onUpdateScreenDimensions(width, screen.height),
                )
              }
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs text-fg-label">
              {t('screens.general.heightPx')}
            </Label>
            <Input
              type="number"
              value={screen.height}
              min={MIN_DIMENSION}
              onChange={(e) =>
                setDimension(e.target.value, (height) =>
                  onUpdateScreenDimensions(screen.width, height),
                )
              }
              className="h-8"
            />
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}

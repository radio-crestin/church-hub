import { useTranslation } from 'react-i18next'

import { Checkbox } from '~/ui/checkbox/Checkbox'
import { Combobox } from '~/ui/combobox/Combobox'
import { Input } from '~/ui/input/Input'
import { Label } from '~/ui/label/Label'
import { Slider } from '~/ui/slider/Slider'
import { SegmentedControl } from './SegmentedControl'
import type { TextStyle } from '../../types'
import { FONT_FAMILY_OPTIONS } from '../../utils/fontFamilyOptions'

const LINE_SEPARATORS = ['space', 'dash', 'pipe'] as const
const HORIZONTAL = ['left', 'center', 'right', 'justify'] as const
const VERTICAL = ['top', 'middle', 'bottom'] as const

interface TextStyleControlsProps {
  style: TextStyle
  onChange: (updates: Partial<TextStyle>) => void
  portalContainer?: HTMLElement | null
}

/** Font, size, colour, alignment and line options of one text element. */
export function TextStyleControls({
  style,
  onChange,
  portalContainer,
}: TextStyleControlsProps) {
  const { t } = useTranslation('presentation')
  const fontFamilyOptions = FONT_FAMILY_OPTIONS.map((option) =>
    option.value === 'system-ui'
      ? { ...option, label: t('screens.textStyle.systemDefault') }
      : option,
  )
  const autoScale = style.autoScale ?? true
  const labelClass = 'text-xs text-gray-500 dark:text-gray-400'

  return (
    <div className="space-y-3">
      <div>
        <Label className={labelClass}>
          {t('screens.textStyle.fontFamily')}
        </Label>
        <Combobox
          value={style.fontFamily}
          onChange={(value) =>
            onChange({ fontFamily: value ? String(value) : undefined })
          }
          options={fontFamilyOptions}
          className="w-full"
          portalContainer={portalContainer}
        />
      </div>
      <div className="space-y-2">
        <Checkbox
          checked={autoScale}
          onCheckedChange={(checked) => onChange({ autoScale: !!checked })}
          label={t('screens.textStyle.autoScale')}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
          {t('screens.textStyle.autoScaleDescription')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className={labelClass}>
            {autoScale
              ? t('screens.textStyle.maxFontSize')
              : t('screens.textStyle.fontSize')}{' '}
            (px)
          </Label>
          <Input
            type="number"
            value={style.maxFontSize}
            onChange={(e) =>
              onChange({ maxFontSize: parseInt(e.target.value) || 24 })
            }
            className="h-8"
          />
        </div>
        {style.autoScale && (
          <div>
            <Label className={labelClass}>
              {t('screens.textStyle.minFontSize')} (px)
            </Label>
            <Input
              type="number"
              value={style.minFontSize ?? 12}
              onChange={(e) =>
                onChange({ minFontSize: parseInt(e.target.value) || 12 })
              }
              className="h-8"
            />
          </div>
        )}
      </div>
      <div>
        <Label className={labelClass}>{t('screens.textStyle.color')}</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={style.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="w-10 h-8 rounded cursor-pointer"
          />
          <Input
            value={style.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-8 flex-1"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Checkbox
          checked={style.bold}
          onCheckedChange={(checked) => onChange({ bold: !!checked })}
          label={t('screens.textStyle.bold')}
        />
        <Checkbox
          checked={style.italic}
          onCheckedChange={(checked) => onChange({ italic: !!checked })}
          label={t('screens.textStyle.italic')}
        />
        <Checkbox
          checked={style.underline}
          onCheckedChange={(checked) => onChange({ underline: !!checked })}
          label={t('screens.textStyle.underline')}
        />
        <Checkbox
          checked={style.shadow ?? false}
          onCheckedChange={(checked) => onChange({ shadow: !!checked })}
          label={t('screens.textStyle.shadow')}
        />
      </div>
      <div>
        <Label className={labelClass}>
          {t('screens.textStyle.horizontalAlignment')}
        </Label>
        <SegmentedControl
          options={HORIZONTAL.map((align) => ({
            value: align,
            label: t(`screens.textStyle.${align}`),
          }))}
          value={style.alignment}
          onChange={(alignment) => onChange({ alignment })}
        />
      </div>
      <div>
        <Label className={labelClass}>
          {t('screens.textStyle.verticalAlignment')}
        </Label>
        <SegmentedControl
          options={VERTICAL.map((align) => ({
            value: align,
            label: t(`screens.textStyle.${align}`),
          }))}
          value={style.verticalAlignment}
          onChange={(verticalAlignment) => onChange({ verticalAlignment })}
        />
      </div>
      <div>
        <Label className={labelClass}>
          {t('screens.textStyle.lineHeight')}
        </Label>
        <div className="flex items-center gap-2">
          <Slider
            value={[style.lineHeight ?? 1.3]}
            onValueChange={([value]) => onChange({ lineHeight: value })}
            min={0.8}
            max={3}
            step={0.1}
            className="flex-1"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
            {(style.lineHeight ?? 1.3).toFixed(1)}
          </span>
        </div>
      </div>

      {/* Line compression */}
      <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <Checkbox
          checked={style.compressLines ?? false}
          onCheckedChange={(checked) => onChange({ compressLines: !!checked })}
          label={t('screens.textStyle.compressLines')}
        />
        {style.compressLines && (
          <div>
            <Label className={labelClass}>
              {t('screens.textStyle.lineSeparator')}
            </Label>
            <Combobox
              value={style.lineSeparator ?? 'space'}
              onChange={(value) =>
                onChange({ lineSeparator: value as TextStyle['lineSeparator'] })
              }
              options={LINE_SEPARATORS.map((separator) => ({
                value: separator,
                label: t(`screens.textStyle.separators.${separator}`),
              }))}
              className="w-full"
              portalContainer={portalContainer}
            />
          </div>
        )}
        <Checkbox
          checked={style.fitLineToWidth ?? false}
          onCheckedChange={(checked) => onChange({ fitLineToWidth: !!checked })}
          label={t('screens.textStyle.fitLineToWidth')}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
          {t('screens.textStyle.fitLineToWidthDescription')}
        </p>
      </div>
    </div>
  )
}

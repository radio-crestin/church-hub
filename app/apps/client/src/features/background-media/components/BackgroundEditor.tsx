import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  ScreenBackgroundConfig,
  ScreenBackgroundType,
} from '~/features/presentation/types'
import { Combobox } from '~/ui/combobox/Combobox'
import { Input } from '~/ui/input/Input'
import { Label } from '~/ui/label/Label'
import { Slider } from '~/ui/slider/Slider'
import { useToast } from '~/ui/toast'
import { BackgroundMediaPicker } from './BackgroundMediaPicker'
import type { BackgroundMediaSelection } from '../service'

const BACKGROUND_TYPES: ScreenBackgroundType[] = [
  'transparent',
  'color',
  'image',
  'video',
]

/** The type select's value for "no background of its own" (`null`). */
const INHERIT = 'inherit'

const DEFAULT_COLOR = '#000000'
/** What a new background starts from when it had none. */
const DEFAULT_BACKGROUND: ScreenBackgroundConfig = {
  type: 'color',
  color: DEFAULT_COLOR,
  opacity: 1,
}

const LABEL_CLASS = 'text-xs text-gray-500 dark:text-gray-400'

interface BackgroundEditorProps {
  /** null = no background of its own (only offered with `allowInherit`) */
  value: ScreenBackgroundConfig | null
  onChange: (next: ScreenBackgroundConfig | null) => void
  /**
   * Offers "Default (screen settings)" as the first type, which clears the
   * background (`null`) so the screen's own one applies.
   */
  allowInherit?: boolean
  portalContainer?: HTMLElement | null
  /** Shown above the controls */
  hint?: ReactNode
}

/**
 * Type, colour, uploaded image/video and opacity of a background — used for a
 * screen's content types and for a song's own background.
 */
export function BackgroundEditor({
  value,
  onChange,
  allowInherit = false,
  portalContainer,
  hint,
}: BackgroundEditorProps) {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()

  // Without `allowInherit` there is always a background to edit.
  const current = value ?? (allowInherit ? null : DEFAULT_BACKGROUND)
  const update = (changes: Partial<ScreenBackgroundConfig>) =>
    onChange({ ...(current ?? DEFAULT_BACKGROUND), ...changes })

  const typeOptions = [
    ...(allowInherit
      ? [{ value: INHERIT, label: t('screens.background.types.inherit') }]
      : []),
    ...BACKGROUND_TYPES.map((type) => ({
      value: type,
      label: t(`screens.background.types.${type}`),
    })),
  ]
  const selectedType = current?.type ?? INHERIT

  const handleTypeChange = (next: number | string | null) => {
    if (!next) return
    if (next === INHERIT) {
      onChange(null)
      return
    }
    update({ type: next as ScreenBackgroundType })
  }

  // The picker uploads images and videos alike: a file of the other kind
  // switches the type to it, so the new upload is what the background shows.
  const handleMediaChange = (media: BackgroundMediaSelection) => {
    if (media.kind !== current?.type) {
      showToast(
        t('screens.background.switchedType', {
          type: t(`screens.background.types.${media.kind}`),
        }),
        'info',
      )
    }
    update(
      media.kind === 'image'
        ? { type: 'image', imageUrl: media.url }
        : { type: 'video', videoUrl: media.url },
    )
  }

  const mediaKind =
    current?.type === 'image' || current?.type === 'video' ? current.type : null

  return (
    <div data-testid="background-editor" className="space-y-3">
      {hint}

      <div>
        <Label className={LABEL_CLASS}>{t('screens.background.type')}</Label>
        <Combobox
          value={selectedType}
          onChange={handleTypeChange}
          options={typeOptions}
          allowClear={false}
          className="w-full"
          portalContainer={portalContainer}
          testId="background-type-select"
        />
      </div>

      {current?.type === 'color' && (
        <div>
          <Label className={LABEL_CLASS}>{t('screens.background.color')}</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={current.color ?? DEFAULT_COLOR}
              onChange={(e) => update({ color: e.target.value })}
              className="w-10 h-8 rounded cursor-pointer"
            />
            <Input
              value={current.color ?? DEFAULT_COLOR}
              onChange={(e) => update({ color: e.target.value })}
              className="h-8 flex-1"
            />
          </div>
        </div>
      )}

      {/* One picker for both kinds, so an upload running while the type flips
          still reports back to it. */}
      {mediaKind && (
        <BackgroundMediaPicker
          kind={mediaKind}
          value={mediaKind === 'image' ? current?.imageUrl : current?.videoUrl}
          onChange={handleMediaChange}
        />
      )}

      {current && current.type !== 'transparent' && (
        <div>
          <Label className={LABEL_CLASS}>
            {t('screens.background.opacity')}
          </Label>
          <Slider
            value={[Math.round((current.opacity ?? 1) * 100)]}
            onValueChange={([opacity]) => update({ opacity: opacity / 100 })}
            min={0}
            max={100}
            step={1}
            formatValue={(opacity) => `${Math.round(opacity)}%`}
            testId="background-opacity"
          />
        </div>
      )}
    </div>
  )
}

import { useTranslation } from 'react-i18next'

import { BackgroundMediaPicker } from '~/features/background-media'
import { Combobox } from '~/ui/combobox/Combobox'
import { Input } from '~/ui/input/Input'
import { Label } from '~/ui/label/Label'
import { Slider } from '~/ui/slider/Slider'
import type {
  ContentType,
  ScreenBackgroundConfig,
  ScreenBackgroundType,
} from '../../types'

const BACKGROUND_TYPES: ScreenBackgroundType[] = [
  'transparent',
  'color',
  'image',
  'video',
]

// A song is drawn with three layouts, each with its own background.
const SONG_CONTENT_TYPES: ContentType[] = [
  'song',
  'song_first_slide',
  'song_last_slide',
]

const LABEL_CLASS = 'text-xs text-gray-500 dark:text-gray-400'

interface BackgroundSettingsProps {
  background: ScreenBackgroundConfig
  contentType: ContentType
  onChange: (background: ScreenBackgroundConfig) => void
  portalContainer?: HTMLElement | null
}

/** The screen editor's Background controls for one content type. */
export function BackgroundSettings({
  background,
  contentType,
  onChange,
  portalContainer,
}: BackgroundSettingsProps) {
  const { t } = useTranslation('presentation')

  const update = (changes: Partial<ScreenBackgroundConfig>) =>
    onChange({ ...background, ...changes })

  const typeOptions = BACKGROUND_TYPES.map((value) => ({
    value,
    label: t(`screens.background.types.${value}`),
  }))

  return (
    <div className="space-y-3">
      {SONG_CONTENT_TYPES.includes(contentType) && (
        <p
          data-testid="background-song-types-hint"
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          {t('screens.background.songTypesHint', {
            song: t('screens.contentTypes.song'),
            firstSlide: t('screens.contentTypes.song_first_slide'),
            lastSlide: t('screens.contentTypes.song_last_slide'),
          })}
        </p>
      )}

      <div>
        <Label className={LABEL_CLASS}>{t('screens.background.type')}</Label>
        <Combobox
          value={background.type}
          onChange={(value) => {
            if (value) update({ type: value as ScreenBackgroundType })
          }}
          options={typeOptions}
          allowClear={false}
          className="w-full"
          portalContainer={portalContainer}
          testId="background-type-select"
        />
      </div>

      {background.type === 'color' && (
        <div>
          <Label className={LABEL_CLASS}>{t('screens.background.color')}</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={background.color ?? '#000000'}
              onChange={(e) => update({ color: e.target.value })}
              className="w-10 h-8 rounded cursor-pointer"
            />
            <Input
              value={background.color ?? '#000000'}
              onChange={(e) => update({ color: e.target.value })}
              className="h-8 flex-1"
            />
          </div>
        </div>
      )}

      {background.type === 'image' && (
        <BackgroundMediaPicker
          kind="image"
          value={background.imageUrl}
          onChange={(imageUrl) => update({ imageUrl })}
        />
      )}

      {background.type === 'video' && (
        <BackgroundMediaPicker
          kind="video"
          value={background.videoUrl}
          onChange={(videoUrl) => update({ videoUrl })}
        />
      )}

      {background.type !== 'transparent' && (
        <div>
          <Label className={LABEL_CLASS}>
            {t('screens.background.opacity')}
          </Label>
          <Slider
            value={[Math.round((background.opacity ?? 1) * 100)]}
            onValueChange={([value]) => update({ opacity: value / 100 })}
            min={0}
            max={100}
            step={1}
            formatValue={(value) => `${Math.round(value)}%`}
            testId="background-opacity"
          />
        </div>
      )}
    </div>
  )
}

import {
  BookOpen,
  Clock,
  Layers,
  MonitorPlay,
  Music,
  Palette,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BackgroundEditor } from '~/features/background-media'
import { Label } from '~/ui/label/Label'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { BackgroundSongTypesHint } from './BackgroundSongTypesHint'
import { ConstraintControls } from './ConstraintControls'
import type { SelectedElement } from './hooks/useEditorState'
import { SegmentedControl } from './SegmentedControl'
import { SettingsSection } from './SettingsSection'
import { SidebarGroupHeading } from './SidebarGroupHeading'
import type {
  BibleContentConfig,
  Constraint,
  Constraints,
  ContentType,
  ContentTypeConfig,
  ReferenceWrapperStyle,
  ScreenShareContentConfig,
  ScreenWithConfigs,
  SizeWithUnits,
  SongContentConfig,
} from '../../types'

/** The elements a slide type can hold, in the order the list shows them. */
const SLIDE_ELEMENTS = [
  'mainText',
  'contentText',
  'referenceText',
  'personLabel',
  'songKey',
  'amen',
  'songTitle',
] as const

/** A shared screen with no saved placement fills the slide. */
const EDGE: Constraint = { enabled: true, value: 0, unit: '%' }
const FULL_SCREEN_VIDEO: { constraints: Constraints; size: SizeWithUnits } = {
  constraints: { top: EDGE, right: EDGE, bottom: EDGE, left: EDGE },
  size: { width: 100, widthUnit: '%', height: 100, heightUnit: '%' },
}

interface SlideTypeSettingsProps {
  screen: ScreenWithConfigs
  contentType: ContentType
  config: ContentTypeConfig
  onUpdateContentConfig: (
    contentType: ContentType,
    config: ContentTypeConfig,
  ) => void
  onSelectElement: (element: SelectedElement) => void
  portalContainer?: HTMLElement | null
}

/**
 * What only the slide type being edited shows: its elements, background,
 * clock and the options of songs, verses or a shared screen.
 */
export function SlideTypeSettings({
  screen,
  contentType,
  config,
  onUpdateContentConfig,
  onSelectElement,
  portalContainer,
}: SlideTypeSettingsProps) {
  const { t } = useTranslation('presentation')
  const update = (changes: Record<string, unknown>) =>
    onUpdateContentConfig(contentType, {
      ...config,
      ...changes,
    } as ContentTypeConfig)
  const clockEnabled = 'clockEnabled' in config && !!config.clockEnabled

  const elements: NonNullable<SelectedElement>['type'][] = [
    ...SLIDE_ELEMENTS.filter(
      (key) =>
        key in config &&
        !!config[key as keyof typeof config] &&
        // The song title is set on the song layout alone (every slide reads it).
        (key !== 'songTitle' || contentType === 'song'),
    ),
    ...(clockEnabled && screen.globalSettings.clockConfig
      ? (['clock'] as const)
      : []),
    ...(screen.nextSlideConfig?.enabled ? (['nextSlide'] as const) : []),
  ]

  const isBible = contentType === 'bible' || contentType === 'bible_passage'
  const bible = config as BibleContentConfig
  const song = config as SongContentConfig
  const screenShare = config as ScreenShareContentConfig

  return (
    <div data-testid="screen-editor-slide-type-settings">
      <SidebarGroupHeading
        title={t('screens.editor.forSlideType', {
          type: t(`screens.contentTypes.${contentType}`),
        })}
        description={t('screens.editor.forSlideTypeDescription')}
      />

      {elements.length > 0 && (
        <SettingsSection
          title={t('screens.editor.elementsTitle')}
          icon={Layers}
        >
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('screens.editor.elementsHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            {elements.map((type) => (
              <button
                key={type}
                type="button"
                data-testid={`screen-editor-element-${type}`}
                onClick={() => onSelectElement({ type })}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {t(`screens.elements.${type}`)}
              </button>
            ))}
          </div>
        </SettingsSection>
      )}

      <SettingsSection title={t('screens.panels.background')} icon={Palette}>
        <BackgroundEditor
          value={config.background}
          onChange={(background) => {
            // Never null here: only `allowInherit` offers clearing it.
            if (background) update({ background })
          }}
          portalContainer={portalContainer}
          hint={<BackgroundSongTypesHint contentType={contentType} />}
        />
      </SettingsSection>

      <SettingsSection title={t('screens.sections.clock')} icon={Clock}>
        <SwitchRow
          label={t('screens.clock.enableForSlideType')}
          description={t('screens.clock.enableDescription')}
          checked={clockEnabled}
          onCheckedChange={(checked) => update({ clockEnabled: checked })}
          testId="screen-editor-clock-enabled"
        />
      </SettingsSection>

      {contentType === 'song' && (
        <SettingsSection title={t('screens.songOptions.title')} icon={Music}>
          <SwitchRow
            label={t('screens.songOptions.displayKeyLine')}
            description={t('screens.songOptions.displayKeyLineDescription')}
            checked={song.displayKeyLine ?? true}
            onCheckedChange={(checked) => update({ displayKeyLine: checked })}
          />
          <SwitchRow
            label={t('screens.songOptions.displayChords')}
            description={t('screens.songOptions.displayChordsDescription')}
            checked={song.displayChords ?? false}
            onCheckedChange={(checked) => update({ displayChords: checked })}
          />
          {song.displayChords && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {t('screens.songOptions.chordFontSize')}
              </label>
              <input
                type="number"
                min={12}
                max={120}
                value={song.chordFontSize ?? 32}
                onChange={(e) =>
                  update({ chordFontSize: Number(e.target.value) || 32 })
                }
                className="w-16 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
              <span className="text-xs text-gray-400">px</span>
            </div>
          )}
        </SettingsSection>
      )}

      {isBible && (
        <SettingsSection
          title={t('screens.bibleOptions.title')}
          icon={BookOpen}
        >
          <SwitchRow
            label={t('screens.bibleOptions.includeReferenceInContent')}
            description={t(
              'screens.bibleOptions.includeReferenceInContentDescription',
            )}
            checked={bible.includeReferenceInContent ?? false}
            onCheckedChange={(checked) =>
              update({ includeReferenceInContent: checked })
            }
          />
          {bible.includeReferenceInContent && (
            <div>
              <Label className="text-xs text-gray-500 dark:text-gray-400">
                {t('screens.bibleOptions.referenceWrapperStyle')}
              </Label>
              <SegmentedControl<ReferenceWrapperStyle>
                options={(['none', 'parentheses', 'brackets'] as const).map(
                  (style) => ({
                    value: style,
                    label: t(`screens.bibleOptions.wrapperStyles.${style}`),
                  }),
                )}
                value={bible.referenceWrapperStyle ?? 'none'}
                onChange={(referenceWrapperStyle) =>
                  update({ referenceWrapperStyle })
                }
              />
            </div>
          )}
        </SettingsSection>
      )}

      {contentType === 'screen_share' && (
        <SettingsSection
          title={t('screens.screenShare.videoSettings')}
          icon={MonitorPlay}
        >
          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">
              {t('screens.screenShare.videoPosition')}
            </Label>
            <ConstraintControls
              constraints={
                screenShare.videoElement?.constraints ??
                FULL_SCREEN_VIDEO.constraints
              }
              size={screenShare.videoElement?.size ?? FULL_SCREEN_VIDEO.size}
              screenWidth={screen.width}
              screenHeight={screen.height}
              onChange={(constraints, size) =>
                update({
                  videoElement: {
                    ...screenShare.videoElement,
                    constraints,
                    size,
                  },
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400">
              {t('screens.screenShare.objectFit')}
            </Label>
            <SegmentedControl
              options={(['contain', 'cover', 'fill'] as const).map((fit) => ({
                value: fit,
                label: t(`screens.screenShare.objectFitOptions.${fit}`),
              }))}
              value={screenShare.videoElement?.objectFit}
              onChange={(objectFit) =>
                update({
                  videoElement: { ...screenShare.videoElement, objectFit },
                })
              }
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('screens.screenShare.objectFitDescription')}
            </p>
          </div>
        </SettingsSection>
      )}
    </div>
  )
}

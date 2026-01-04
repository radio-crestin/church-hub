import { ClockElement } from './ClockElement'
import { TextElement } from './TextElement'
import type {
  AnnouncementContentConfig,
  BibleContentConfig,
  ClockElementConfig,
  ContentConfigs,
  ContentType,
  EmptyContentConfig,
  GlobalSettings,
  SongContentConfig,
  VerseteTineriContentConfig,
} from '../../types'
import { formatReferenceWithWrapper } from '../../utils/formatReferenceWithWrapper'

interface ContentData {
  type: ContentType
  mainText?: string
  referenceText?: string
  contentText?: string
  personLabel?: string
}

interface ContentRendererProps {
  contentType: ContentType
  contentData: ContentData
  config: ContentConfigs[ContentType]
  globalSettings: GlobalSettings
  screenWidth: number
  screenHeight: number
  isVisible: boolean
}

export function ContentRenderer({
  contentType,
  contentData,
  config,
  globalSettings,
  screenWidth,
  screenHeight,
  isVisible,
}: ContentRendererProps) {
  // Use global clockConfig for position/style, per-content-type clockEnabled for enable
  const clockConfig = globalSettings.clockConfig

  // Helper to check if clock is enabled for a content type
  const isClockEnabled = (cfg: ContentConfigs[ContentType]) =>
    'clockEnabled' in cfg && cfg.clockEnabled && clockConfig

  switch (contentType) {
    case 'song': {
      const songConfig = config as SongContentConfig
      return (
        <SongRenderer
          config={songConfig}
          content={contentData.mainText || ''}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          isVisible={isVisible}
          showClock={isClockEnabled(songConfig)}
          clockConfig={clockConfig}
        />
      )
    }

    case 'bible':
    case 'bible_passage': {
      const bibleConfig = config as BibleContentConfig
      return (
        <BibleRenderer
          config={bibleConfig}
          reference={contentData.referenceText || ''}
          content={contentData.contentText || ''}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          isVisible={isVisible}
          showClock={isClockEnabled(bibleConfig)}
          clockConfig={clockConfig}
        />
      )
    }

    case 'announcement': {
      const announcementConfig = config as AnnouncementContentConfig
      return (
        <AnnouncementRenderer
          config={announcementConfig}
          content={contentData.mainText || ''}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          isVisible={isVisible}
          showClock={isClockEnabled(announcementConfig)}
          clockConfig={clockConfig}
        />
      )
    }

    case 'versete_tineri': {
      const vtConfig = config as VerseteTineriContentConfig
      return (
        <VerseteTineriRenderer
          config={vtConfig}
          personLabel={contentData.personLabel || ''}
          reference={contentData.referenceText || ''}
          content={contentData.contentText || ''}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          isVisible={isVisible}
          showClock={isClockEnabled(vtConfig)}
          clockConfig={clockConfig}
        />
      )
    }

    case 'empty': {
      const emptyConfig = config as EmptyContentConfig
      return (
        <EmptyRenderer
          config={emptyConfig}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          showClock={isClockEnabled(emptyConfig)}
          clockConfig={clockConfig}
        />
      )
    }

    default:
      return null
  }
}

interface SongRendererProps {
  config: SongContentConfig
  content: string
  screenWidth: number
  screenHeight: number
  isVisible: boolean
  showClock: boolean
  clockConfig?: ClockElementConfig
}

function SongRenderer({
  config,
  content,
  screenWidth,
  screenHeight,
  isVisible,
  showClock,
  clockConfig,
}: SongRendererProps) {
  return (
    <>
      <TextElement
        config={config.mainText}
        content={content}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        isVisible={isVisible}
        isHtml={true}
      />
      {showClock && clockConfig && (
        <ClockElement
          config={clockConfig}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      )}
    </>
  )
}

interface BibleRendererProps {
  config: BibleContentConfig
  reference: string
  content: string
  screenWidth: number
  screenHeight: number
  isVisible: boolean
  showClock: boolean
  clockConfig?: ClockElementConfig
}

function BibleRenderer({
  config,
  reference,
  content,
  screenWidth,
  screenHeight,
  isVisible,
  showClock,
  clockConfig,
}: BibleRendererProps) {
  // Determine if reference should be included in content
  const showReferenceElement =
    !config.includeReferenceInContent && !config.referenceText.hidden
  const formattedReference = reference
    ? formatReferenceWithWrapper(reference, config.referenceWrapperStyle)
    : ''
  const displayContent =
    config.includeReferenceInContent && reference
      ? `${formattedReference} ${content}`
      : content

  return (
    <>
      {showReferenceElement && (
        <TextElement
          config={config.referenceText}
          content={reference}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          isVisible={isVisible}
        />
      )}
      <TextElement
        config={config.contentText}
        content={displayContent}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        isVisible={isVisible}
      />
      {showClock && clockConfig && (
        <ClockElement
          config={clockConfig}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      )}
    </>
  )
}

interface AnnouncementRendererProps {
  config: AnnouncementContentConfig
  content: string
  screenWidth: number
  screenHeight: number
  isVisible: boolean
  showClock: boolean
  clockConfig?: ClockElementConfig
}

function AnnouncementRenderer({
  config,
  content,
  screenWidth,
  screenHeight,
  isVisible,
  showClock,
  clockConfig,
}: AnnouncementRendererProps) {
  return (
    <>
      <TextElement
        config={config.mainText}
        content={content}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        isVisible={isVisible}
        isHtml={true}
      />
      {showClock && clockConfig && (
        <ClockElement
          config={clockConfig}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      )}
    </>
  )
}

interface VerseteTineriRendererProps {
  config: VerseteTineriContentConfig
  personLabel: string
  reference: string
  content: string
  screenWidth: number
  screenHeight: number
  isVisible: boolean
  showClock: boolean
  clockConfig?: ClockElementConfig
}

function VerseteTineriRenderer({
  config,
  personLabel,
  reference,
  content,
  screenWidth,
  screenHeight,
  isVisible,
  showClock,
  clockConfig,
}: VerseteTineriRendererProps) {
  return (
    <>
      <TextElement
        config={config.personLabel}
        content={personLabel}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        isVisible={isVisible}
      />
      <TextElement
        config={config.referenceText}
        content={reference}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        isVisible={isVisible}
      />
      <TextElement
        config={config.contentText}
        content={content}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        isVisible={isVisible}
      />
      {showClock && clockConfig && (
        <ClockElement
          config={clockConfig}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      )}
    </>
  )
}

interface EmptyRendererProps {
  config: EmptyContentConfig
  screenWidth: number
  screenHeight: number
  showClock: boolean
  clockConfig?: ClockElementConfig
}

function EmptyRenderer({
  screenWidth,
  screenHeight,
  showClock,
  clockConfig,
}: EmptyRendererProps) {
  if (!showClock || !clockConfig) return null
  return (
    <ClockElement
      config={clockConfig}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
    />
  )
}

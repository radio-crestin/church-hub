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
  // Use global clock settings for all content types to keep position/config synced
  const showClock = globalSettings.clockEnabled
  const clockConfig = globalSettings.clockConfig

  switch (contentType) {
    case 'song':
      return (
        <SongRenderer
          config={config as SongContentConfig}
          content={contentData.mainText || ''}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          isVisible={isVisible}
          showClock={showClock}
          clockConfig={clockConfig}
        />
      )

    case 'bible':
    case 'bible_passage':
      return (
        <BibleRenderer
          config={config as BibleContentConfig}
          reference={contentData.referenceText || ''}
          content={contentData.contentText || ''}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          isVisible={isVisible}
          showClock={showClock}
          clockConfig={clockConfig}
        />
      )

    case 'announcement':
      return (
        <AnnouncementRenderer
          config={config as AnnouncementContentConfig}
          content={contentData.mainText || ''}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          isVisible={isVisible}
          showClock={showClock}
          clockConfig={clockConfig}
        />
      )

    case 'versete_tineri':
      return (
        <VerseteTineriRenderer
          config={config as VerseteTineriContentConfig}
          personLabel={contentData.personLabel || ''}
          reference={contentData.referenceText || ''}
          content={contentData.contentText || ''}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          isVisible={isVisible}
          showClock={showClock}
          clockConfig={clockConfig}
        />
      )

    case 'empty':
      return (
        <EmptyRenderer
          config={config as EmptyContentConfig}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          clockConfig={clockConfig}
        />
      )

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
  const displayContent =
    config.includeReferenceInContent && reference
      ? `${reference} ${content}`
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
  clockConfig?: ClockElementConfig
}

function EmptyRenderer({
  screenWidth,
  screenHeight,
  clockConfig,
}: EmptyRendererProps) {
  if (!clockConfig) return null
  return (
    <ClockElement
      config={clockConfig}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
    />
  )
}

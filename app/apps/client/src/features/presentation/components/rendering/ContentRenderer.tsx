import { ClockElement } from './ClockElement'
import { TextElement } from './TextElement'
import type {
  AnnouncementContentConfig,
  BibleContentConfig,
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
  const showClock = globalSettings.clockEnabled

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
        />
      )

    case 'empty':
      return (
        <EmptyRenderer
          config={config as EmptyContentConfig}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
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
}

function SongRenderer({
  config,
  content,
  screenWidth,
  screenHeight,
  isVisible,
  showClock,
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
      {showClock && config.clock && (
        <ClockElement
          config={config.clock}
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
}

function BibleRenderer({
  config,
  reference,
  content,
  screenWidth,
  screenHeight,
  isVisible,
  showClock,
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
      {showClock && config.clock && (
        <ClockElement
          config={config.clock}
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
}

function AnnouncementRenderer({
  config,
  content,
  screenWidth,
  screenHeight,
  isVisible,
  showClock,
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
      {showClock && config.clock && (
        <ClockElement
          config={config.clock}
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
      {showClock && config.clock && (
        <ClockElement
          config={config.clock}
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
}

function EmptyRenderer({
  config,
  screenWidth,
  screenHeight,
}: EmptyRendererProps) {
  return (
    <ClockElement
      config={config.clock}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
    />
  )
}

import {
  calculatePixelPosition,
  calculatePixelSize,
  getBackgroundCSS,
  getTextStyleCSS,
} from './utils/styleUtils'
import type { ContentType, NextSlideSectionConfig } from '../../types'

interface NextSlideData {
  contentType: ContentType
  preview: string
}

interface NextSlideSectionProps {
  config: NextSlideSectionConfig
  nextSlideData?: NextSlideData
  screenWidth: number
  screenHeight: number
}

export function NextSlideSection({
  config,
  nextSlideData,
  screenWidth,
  screenHeight,
}: NextSlideSectionProps) {
  if (!config.enabled) {
    return null
  }

  const position = calculatePixelPosition(config.position, {
    width: screenWidth,
    height: screenHeight,
  })

  const size = calculatePixelSize(config.size, {
    width: screenWidth,
    height: screenHeight,
  })

  const containerStyles: React.CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
    ...getBackgroundCSS(config.background),
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '0 24px',
  }

  const labelStyles: React.CSSProperties = {
    ...getTextStyleCSS(config.labelStyle),
    fontSize: config.labelStyle.maxFontSize,
    flexShrink: 0,
  }

  const contentStyles: React.CSSProperties = {
    ...getTextStyleCSS(config.contentStyle),
    fontSize: config.contentStyle.maxFontSize,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={containerStyles}>
      <span style={labelStyles}>{config.labelText}</span>
      <span style={contentStyles}>{nextSlideData?.preview || '—'}</span>
    </div>
  )
}

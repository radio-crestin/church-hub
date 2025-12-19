import {
  calculatePixelBounds,
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

  // Use constraints-based positioning
  const bounds = calculatePixelBounds(
    config.constraints,
    config.size,
    screenWidth,
    screenHeight,
  )

  const containerStyles: React.CSSProperties = {
    position: 'absolute',
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
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

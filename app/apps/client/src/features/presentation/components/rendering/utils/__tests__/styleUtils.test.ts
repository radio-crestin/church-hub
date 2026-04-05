import { describe, expect, it } from 'vitest'

import type {
  AnimationConfig,
  Constraints,
  SizeWithUnits,
} from '../../../../types'
import {
  calculateConstraintStyles,
  calculateMaxExitAnimationDuration,
  calculateMaxSlideTransitionInDuration,
  calculateMaxSlideTransitionOutDuration,
  calculatePixelBounds,
  calculatePixelPosition,
  calculatePixelSize,
  calculatePixelSizeWithUnits,
  clampBoundsToScreen,
  convertUnit,
  getAlignItems,
  getBackgroundCSS,
  getJustifyContent,
  getTextStyleCSS,
  roundForDisplay,
  toPercent,
  toPixels,
} from '../styleUtils'

describe('styleUtils', () => {
  // ========================================================================
  // Unit conversion functions
  // ========================================================================

  describe('toPixels', () => {
    it('converts percentage to pixels', () => {
      expect(toPixels(50, '%', 1920)).toBe(960)
    })

    it('returns pixel value as-is', () => {
      expect(toPixels(100, 'px', 1920)).toBe(100)
    })

    it('handles 0%', () => {
      expect(toPixels(0, '%', 1920)).toBe(0)
    })

    it('handles 100%', () => {
      expect(toPixels(100, '%', 1920)).toBe(1920)
    })

    it('handles fractional percentages', () => {
      expect(toPixels(33.33, '%', 900)).toBeCloseTo(299.97, 1)
    })
  })

  describe('toPercent', () => {
    it('converts pixels to percentage', () => {
      expect(toPercent(960, 1920)).toBe(50)
    })

    it('returns 0 when totalPixels is 0 (avoid division by zero)', () => {
      expect(toPercent(100, 0)).toBe(0)
    })

    it('handles 0 pixel value', () => {
      expect(toPercent(0, 1920)).toBe(0)
    })

    it('handles value equal to total', () => {
      expect(toPercent(1920, 1920)).toBe(100)
    })
  })

  describe('convertUnit', () => {
    it('returns same value when units match (% to %)', () => {
      expect(convertUnit(50, '%', '%', 1920)).toBe(50)
    })

    it('returns same value when units match (px to px)', () => {
      expect(convertUnit(100, 'px', 'px', 1920)).toBe(100)
    })

    it('converts % to px', () => {
      expect(convertUnit(50, '%', 'px', 1920)).toBe(960)
    })

    it('converts px to %', () => {
      expect(convertUnit(960, 'px', '%', 1920)).toBe(50)
    })
  })

  describe('roundForDisplay', () => {
    it('rounds to one decimal place', () => {
      expect(roundForDisplay(3.14159)).toBe(3.1)
    })

    it('rounds up correctly', () => {
      expect(roundForDisplay(3.15)).toBe(3.2)
    })

    it('keeps integers as-is', () => {
      expect(roundForDisplay(42)).toBe(42)
    })

    it('handles negative numbers', () => {
      expect(roundForDisplay(-2.75)).toBe(-2.7)
    })

    it('handles zero', () => {
      expect(roundForDisplay(0)).toBe(0)
    })
  })

  // ========================================================================
  // Position and size calculations
  // ========================================================================

  describe('calculatePixelPosition', () => {
    it('converts percentage position to pixels', () => {
      const result = calculatePixelPosition(
        { x: 50, y: 25, unit: '%' },
        { width: 1920, height: 1080 },
      )
      expect(result).toEqual({ x: 960, y: 270 })
    })

    it('returns pixel position as-is', () => {
      const result = calculatePixelPosition(
        { x: 100, y: 200, unit: 'px' },
        { width: 1920, height: 1080 },
      )
      expect(result).toEqual({ x: 100, y: 200 })
    })

    it('handles zero position', () => {
      const result = calculatePixelPosition(
        { x: 0, y: 0, unit: '%' },
        { width: 1920, height: 1080 },
      )
      expect(result).toEqual({ x: 0, y: 0 })
    })
  })

  describe('calculatePixelSize', () => {
    it('converts percentage size to pixels', () => {
      const result = calculatePixelSize(
        { width: 50, height: 50, unit: '%' },
        { width: 1920, height: 1080 },
      )
      expect(result).toEqual({ width: 960, height: 540 })
    })

    it('returns pixel size as-is', () => {
      const result = calculatePixelSize(
        { width: 400, height: 300, unit: 'px' },
        { width: 1920, height: 1080 },
      )
      expect(result).toEqual({ width: 400, height: 300 })
    })
  })

  describe('calculatePixelSizeWithUnits', () => {
    it('converts mixed units (width in %, height in px)', () => {
      const result = calculatePixelSizeWithUnits(
        { width: 50, widthUnit: '%', height: 300, heightUnit: 'px' },
        { width: 1920, height: 1080 },
      )
      expect(result).toEqual({ width: 960, height: 300 })
    })

    it('converts both percentage units', () => {
      const result = calculatePixelSizeWithUnits(
        { width: 100, widthUnit: '%', height: 100, heightUnit: '%' },
        { width: 1920, height: 1080 },
      )
      expect(result).toEqual({ width: 1920, height: 1080 })
    })
  })

  // ========================================================================
  // CSS generation functions
  // ========================================================================

  describe('getTextStyleCSS', () => {
    it('generates correct CSS for bold, italic, underlined text with shadow', () => {
      const result = getTextStyleCSS({
        fontFamily: 'Arial',
        maxFontSize: 48,
        autoScale: true,
        color: '#FFFFFF',
        bold: true,
        italic: true,
        underline: true,
        alignment: 'center',
        verticalAlignment: 'middle',
        lineHeight: 1.4,
        shadow: true,
      })

      expect(result.fontFamily).toBe('Arial')
      expect(result.color).toBe('#FFFFFF')
      expect(result.fontWeight).toBe('bold')
      expect(result.fontStyle).toBe('italic')
      expect(result.textDecoration).toBe('underline')
      expect(result.textAlign).toBe('center')
      expect(result.lineHeight).toBe(1.4)
      expect(result.textShadow).toBe('2px 2px 4px rgba(0,0,0,0.5)')
    })

    it('generates correct CSS for plain text without shadow', () => {
      const result = getTextStyleCSS({
        fontFamily: 'Roboto',
        maxFontSize: 32,
        autoScale: false,
        color: '#000000',
        bold: false,
        italic: false,
        underline: false,
        alignment: 'left',
        verticalAlignment: 'top',
        lineHeight: 1.2,
        shadow: false,
      })

      expect(result.fontWeight).toBe('normal')
      expect(result.fontStyle).toBe('normal')
      expect(result.textDecoration).toBe('none')
      expect(result.textShadow).toBe('none')
    })

    it('handles undefined shadow as no shadow', () => {
      const result = getTextStyleCSS({
        fontFamily: 'Arial',
        maxFontSize: 24,
        autoScale: true,
        color: '#FFF',
        bold: false,
        italic: false,
        underline: false,
        alignment: 'right',
        verticalAlignment: 'bottom',
        lineHeight: 1.0,
      })

      expect(result.textShadow).toBe('none')
    })
  })

  describe('getJustifyContent', () => {
    it('returns flex-start for left alignment', () => {
      expect(getJustifyContent('left')).toBe('flex-start')
    })

    it('returns center for center alignment', () => {
      expect(getJustifyContent('center')).toBe('center')
    })

    it('returns flex-end for right alignment', () => {
      expect(getJustifyContent('right')).toBe('flex-end')
    })

    it('returns flex-start for justify alignment', () => {
      expect(getJustifyContent('justify')).toBe('flex-start')
    })

    it('returns flex-start for unknown alignment', () => {
      expect(getJustifyContent('unknown' as never)).toBe('flex-start')
    })
  })

  describe('getAlignItems', () => {
    it('returns flex-start for top', () => {
      expect(getAlignItems('top')).toBe('flex-start')
    })

    it('returns center for middle', () => {
      expect(getAlignItems('middle')).toBe('center')
    })

    it('returns flex-end for bottom', () => {
      expect(getAlignItems('bottom')).toBe('flex-end')
    })

    it('returns center for unknown', () => {
      expect(getAlignItems('unknown' as never)).toBe('center')
    })
  })

  describe('getBackgroundCSS', () => {
    it('returns transparent background', () => {
      const result = getBackgroundCSS({ type: 'transparent', opacity: 1 })
      expect(result).toEqual({ backgroundColor: 'transparent' })
    })

    it('returns color background with opacity', () => {
      const result = getBackgroundCSS({
        type: 'color',
        color: '#FF0000',
        opacity: 0.8,
      })
      expect(result).toEqual({ backgroundColor: '#FF0000', opacity: 0.8 })
    })

    it('returns color background with default opacity', () => {
      const result = getBackgroundCSS({
        type: 'color',
        color: '#00FF00',
        opacity: 1,
      })
      expect(result).toEqual({ backgroundColor: '#00FF00', opacity: 1 })
    })

    it('returns color background with fallback when no color specified', () => {
      const result = getBackgroundCSS({ type: 'color', opacity: 1 })
      expect(result.backgroundColor).toBe('#000000')
    })

    it('returns image background', () => {
      const result = getBackgroundCSS({
        type: 'image',
        imageUrl: 'https://example.com/bg.jpg',
        opacity: 0.9,
      })
      expect(result).toEqual({
        backgroundImage: 'url(https://example.com/bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.9,
      })
    })

    it('returns "none" backgroundImage when no imageUrl', () => {
      const result = getBackgroundCSS({ type: 'image', opacity: 1 })
      expect(result.backgroundImage).toBe('none')
    })

    it('returns transparent for video type', () => {
      const result = getBackgroundCSS({ type: 'video', opacity: 1 })
      expect(result).toEqual({ backgroundColor: 'transparent' })
    })

    it('returns black for unknown type', () => {
      const result = getBackgroundCSS({ type: 'unknown' as never, opacity: 1 })
      expect(result).toEqual({ backgroundColor: '#000000' })
    })
  })

  // ========================================================================
  // Constraint-based positioning
  // ========================================================================

  describe('calculateConstraintStyles', () => {
    const defaultConstraints: Constraints = {
      top: { enabled: true, value: 10, unit: '%' },
      bottom: { enabled: false, value: 0, unit: '%' },
      left: { enabled: true, value: 5, unit: '%' },
      right: { enabled: false, value: 0, unit: '%' },
    }

    const defaultSize: SizeWithUnits = {
      width: 50,
      widthUnit: '%',
      height: 30,
      heightUnit: '%',
    }

    it('applies top and left constraints with explicit size', () => {
      const result = calculateConstraintStyles(
        defaultConstraints,
        defaultSize,
        1920,
        1080,
      )
      expect(result.position).toBe('absolute')
      expect(result.top).toBe('10%')
      expect(result.left).toBe('5%')
      expect(result.width).toBe('50%')
      expect(result.height).toBe('30%')
      expect(result.bottom).toBeUndefined()
      expect(result.right).toBeUndefined()
    })

    it('stretches width when both left and right are enabled', () => {
      const constraints: Constraints = {
        top: { enabled: true, value: 0, unit: '%' },
        bottom: { enabled: false, value: 0, unit: '%' },
        left: { enabled: true, value: 10, unit: 'px' },
        right: { enabled: true, value: 10, unit: 'px' },
      }
      const result = calculateConstraintStyles(
        constraints,
        defaultSize,
        1920,
        1080,
      )
      expect(result.left).toBe('10px')
      expect(result.right).toBe('10px')
      expect(result.width).toBeUndefined() // auto-stretch
    })

    it('stretches height when both top and bottom are enabled', () => {
      const constraints: Constraints = {
        top: { enabled: true, value: 5, unit: '%' },
        bottom: { enabled: true, value: 5, unit: '%' },
        left: { enabled: true, value: 0, unit: '%' },
        right: { enabled: false, value: 0, unit: '%' },
      }
      const result = calculateConstraintStyles(
        constraints,
        defaultSize,
        1920,
        1080,
      )
      expect(result.top).toBe('5%')
      expect(result.bottom).toBe('5%')
      expect(result.height).toBeUndefined() // auto-stretch
    })

    it('defaults to left=0 when no horizontal constraints', () => {
      const constraints: Constraints = {
        top: { enabled: true, value: 0, unit: '%' },
        bottom: { enabled: false, value: 0, unit: '%' },
        left: { enabled: false, value: 0, unit: '%' },
        right: { enabled: false, value: 0, unit: '%' },
      }
      const result = calculateConstraintStyles(
        constraints,
        defaultSize,
        1920,
        1080,
      )
      expect(result.left).toBe('0')
    })

    it('defaults to top=0 when no vertical constraints', () => {
      const constraints: Constraints = {
        top: { enabled: false, value: 0, unit: '%' },
        bottom: { enabled: false, value: 0, unit: '%' },
        left: { enabled: true, value: 0, unit: '%' },
        right: { enabled: false, value: 0, unit: '%' },
      }
      const result = calculateConstraintStyles(
        constraints,
        defaultSize,
        1920,
        1080,
      )
      expect(result.top).toBe('0')
    })

    it('uses default constraints when undefined', () => {
      const result = calculateConstraintStyles(undefined, undefined, 1920, 1080)
      expect(result.position).toBe('absolute')
      expect(result.top).toBe('0%')
      expect(result.left).toBe('0%')
      expect(result.width).toBe('100%')
      expect(result.height).toBe('100%')
    })

    it('handles pixel units in constraints', () => {
      const constraints: Constraints = {
        top: { enabled: true, value: 50, unit: 'px' },
        bottom: { enabled: false, value: 0, unit: 'px' },
        left: { enabled: true, value: 100, unit: 'px' },
        right: { enabled: false, value: 0, unit: 'px' },
      }
      const size: SizeWithUnits = {
        width: 800,
        widthUnit: 'px',
        height: 600,
        heightUnit: 'px',
      }
      const result = calculateConstraintStyles(constraints, size, 1920, 1080)
      expect(result.top).toBe('50px')
      expect(result.left).toBe('100px')
      expect(result.width).toBe('800px')
      expect(result.height).toBe('600px')
    })
  })

  // ========================================================================
  // Pixel bounds calculation
  // ========================================================================

  describe('calculatePixelBounds', () => {
    it('calculates bounds with left + top constraints', () => {
      const constraints: Constraints = {
        top: { enabled: true, value: 10, unit: '%' },
        bottom: { enabled: false, value: 0, unit: '%' },
        left: { enabled: true, value: 5, unit: '%' },
        right: { enabled: false, value: 0, unit: '%' },
      }
      const size: SizeWithUnits = {
        width: 50,
        widthUnit: '%',
        height: 30,
        heightUnit: '%',
      }
      const result = calculatePixelBounds(constraints, size, 1920, 1080)
      expect(result.x).toBe(96) // 5% of 1920
      expect(result.y).toBe(108) // 10% of 1080
      expect(result.width).toBe(960) // 50% of 1920
      expect(result.height).toBe(324) // 30% of 1080
    })

    it('calculates bounds with left + right (stretched width)', () => {
      const constraints: Constraints = {
        top: { enabled: true, value: 0, unit: '%' },
        bottom: { enabled: false, value: 0, unit: '%' },
        left: { enabled: true, value: 10, unit: '%' },
        right: { enabled: true, value: 10, unit: '%' },
      }
      const size: SizeWithUnits = {
        width: 100,
        widthUnit: '%',
        height: 50,
        heightUnit: '%',
      }
      const result = calculatePixelBounds(constraints, size, 1000, 500)
      expect(result.x).toBe(100) // 10% of 1000
      expect(result.width).toBe(800) // 1000 - 100 - 100
    })

    it('calculates bounds with right constraint only', () => {
      const constraints: Constraints = {
        top: { enabled: true, value: 0, unit: '%' },
        bottom: { enabled: false, value: 0, unit: '%' },
        left: { enabled: false, value: 0, unit: '%' },
        right: { enabled: true, value: 100, unit: 'px' },
      }
      const size: SizeWithUnits = {
        width: 400,
        widthUnit: 'px',
        height: 300,
        heightUnit: 'px',
      }
      const result = calculatePixelBounds(constraints, size, 1920, 1080)
      expect(result.x).toBe(1920 - 100 - 400) // 1420
      expect(result.width).toBe(400)
    })

    it('calculates bounds with bottom constraint only', () => {
      const constraints: Constraints = {
        top: { enabled: false, value: 0, unit: '%' },
        bottom: { enabled: true, value: 50, unit: 'px' },
        left: { enabled: true, value: 0, unit: '%' },
        right: { enabled: false, value: 0, unit: '%' },
      }
      const size: SizeWithUnits = {
        width: 100,
        widthUnit: '%',
        height: 200,
        heightUnit: 'px',
      }
      const result = calculatePixelBounds(constraints, size, 1920, 1080)
      expect(result.y).toBe(1080 - 50 - 200) // 830
      expect(result.height).toBe(200)
    })

    it('calculates bounds with top + bottom (stretched height)', () => {
      const constraints: Constraints = {
        top: { enabled: true, value: 10, unit: '%' },
        bottom: { enabled: true, value: 10, unit: '%' },
        left: { enabled: true, value: 0, unit: '%' },
        right: { enabled: false, value: 0, unit: '%' },
      }
      const size: SizeWithUnits = {
        width: 100,
        widthUnit: '%',
        height: 100,
        heightUnit: '%',
      }
      const result = calculatePixelBounds(constraints, size, 1000, 1000)
      expect(result.y).toBe(100) // 10% of 1000
      expect(result.height).toBe(800) // 1000 - 100 - 100
    })

    it('uses defaults when constraints/size are undefined', () => {
      const result = calculatePixelBounds(undefined, undefined, 1920, 1080)
      expect(result.x).toBe(0)
      expect(result.y).toBe(0)
      expect(result.width).toBe(1920)
      expect(result.height).toBe(1080)
    })

    it('defaults to x=0 when no horizontal constraints', () => {
      const constraints: Constraints = {
        top: { enabled: true, value: 0, unit: '%' },
        bottom: { enabled: false, value: 0, unit: '%' },
        left: { enabled: false, value: 0, unit: '%' },
        right: { enabled: false, value: 0, unit: '%' },
      }
      const size: SizeWithUnits = {
        width: 50,
        widthUnit: '%',
        height: 50,
        heightUnit: '%',
      }
      const result = calculatePixelBounds(constraints, size, 1920, 1080)
      expect(result.x).toBe(0)
      expect(result.width).toBe(960)
    })
  })

  describe('clampBoundsToScreen', () => {
    it('leaves in-bounds element unchanged', () => {
      const result = clampBoundsToScreen(
        { x: 100, y: 100, width: 400, height: 300 },
        1920,
        1080,
      )
      expect(result).toEqual({ x: 100, y: 100, width: 400, height: 300 })
    })

    it('clamps negative x to 0', () => {
      const result = clampBoundsToScreen(
        { x: -50, y: 100, width: 200, height: 200 },
        1920,
        1080,
      )
      expect(result.x).toBe(0)
    })

    it('clamps negative y to 0', () => {
      const result = clampBoundsToScreen(
        { x: 100, y: -30, width: 200, height: 200 },
        1920,
        1080,
      )
      expect(result.y).toBe(0)
    })

    it('clamps x when element extends past right edge', () => {
      const result = clampBoundsToScreen(
        { x: 1800, y: 100, width: 200, height: 100 },
        1920,
        1080,
      )
      expect(result.x).toBe(1720) // 1920 - 200
    })

    it('clamps y when element extends past bottom edge', () => {
      const result = clampBoundsToScreen(
        { x: 100, y: 1000, width: 200, height: 200 },
        1920,
        1080,
      )
      expect(result.y).toBe(880) // 1080 - 200
    })

    it('ensures minimum width of 1px', () => {
      const result = clampBoundsToScreen(
        { x: 100, y: 100, width: 0, height: 100 },
        1920,
        1080,
      )
      expect(result.width).toBe(1)
    })

    it('ensures minimum height of 1px', () => {
      const result = clampBoundsToScreen(
        { x: 100, y: 100, width: 100, height: -5 },
        1920,
        1080,
      )
      expect(result.height).toBe(1)
    })

    it('clamps width to screen width', () => {
      const result = clampBoundsToScreen(
        { x: 0, y: 0, width: 5000, height: 100 },
        1920,
        1080,
      )
      expect(result.width).toBe(1920)
    })

    it('clamps height to screen height', () => {
      const result = clampBoundsToScreen(
        { x: 0, y: 0, width: 100, height: 5000 },
        1920,
        1080,
      )
      expect(result.height).toBe(1080)
    })
  })

  // ========================================================================
  // Animation duration calculations
  // ========================================================================

  describe('calculateMaxExitAnimationDuration', () => {
    it('returns 0 for undefined config', () => {
      expect(calculateMaxExitAnimationDuration(undefined)).toBe(0)
    })

    it('returns 0 when no exit animations are configured', () => {
      const config = {
        background: { type: 'color' as const, color: '#000', opacity: 1 },
        mainText: {
          constraints: {} as Constraints,
          size: {} as SizeWithUnits,
          style: {} as never,
          padding: 0,
          animationIn: {
            type: 'fade',
            duration: 300,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          animationOut: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
        },
      }
      expect(calculateMaxExitAnimationDuration(config)).toBe(0)
    })

    it('returns duration + delay for a single exit animation', () => {
      const config = {
        background: { type: 'color' as const, color: '#000', opacity: 1 },
        mainText: {
          constraints: {} as Constraints,
          size: {} as SizeWithUnits,
          style: {} as never,
          padding: 0,
          animationIn: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          animationOut: {
            type: 'fade',
            duration: 500,
            delay: 100,
            easing: 'ease',
          } as AnimationConfig,
        },
      }
      expect(calculateMaxExitAnimationDuration(config)).toBe(600)
    })

    it('returns the maximum across multiple exit animations', () => {
      const config = {
        background: { type: 'color' as const, color: '#000', opacity: 1 },
        contentText: {
          constraints: {} as Constraints,
          size: {} as SizeWithUnits,
          style: {} as never,
          padding: 0,
          animationIn: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          animationOut: {
            type: 'fade',
            duration: 200,
            delay: 50,
            easing: 'ease',
          } as AnimationConfig,
        },
        referenceText: {
          constraints: {} as Constraints,
          size: {} as SizeWithUnits,
          style: {} as never,
          animationIn: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          animationOut: {
            type: 'slide-left',
            duration: 400,
            delay: 200,
            easing: 'ease',
          } as AnimationConfig,
        },
      }
      // contentText: 250, referenceText: 600
      expect(calculateMaxExitAnimationDuration(config)).toBe(600)
    })

    it('handles config with personLabel animationOut', () => {
      const config = {
        background: { type: 'color' as const, color: '#000', opacity: 1 },
        personLabel: {
          constraints: {} as Constraints,
          size: {} as SizeWithUnits,
          style: {} as never,
          animationIn: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          animationOut: {
            type: 'fade',
            duration: 350,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
        },
      }
      expect(calculateMaxExitAnimationDuration(config)).toBe(350)
    })

    it('uses default duration of 300 when duration is undefined', () => {
      const config = {
        background: { type: 'color' as const, color: '#000', opacity: 1 },
        mainText: {
          constraints: {} as Constraints,
          size: {} as SizeWithUnits,
          style: {} as never,
          padding: 0,
          animationIn: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          animationOut: { type: 'fade', easing: 'ease' } as AnimationConfig,
        },
      }
      // Default duration 300 + default delay 0 = 300
      expect(calculateMaxExitAnimationDuration(config)).toBe(300)
    })
  })

  describe('calculateMaxSlideTransitionOutDuration', () => {
    it('returns 250 (default) for undefined config', () => {
      expect(calculateMaxSlideTransitionOutDuration(undefined)).toBe(250)
    })

    it('returns 250 (default) when no slide transitions are configured', () => {
      const config = {
        background: { type: 'color' as const, color: '#000', opacity: 1 },
        mainText: {
          constraints: {} as Constraints,
          size: {} as SizeWithUnits,
          style: {} as never,
          padding: 0,
          animationIn: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          animationOut: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
        },
      }
      expect(calculateMaxSlideTransitionOutDuration(config)).toBe(250)
    })

    it('returns max slideTransitionOut duration across elements', () => {
      const config = {
        background: { type: 'color' as const, color: '#000', opacity: 1 },
        mainText: {
          constraints: {} as Constraints,
          size: {} as SizeWithUnits,
          style: {} as never,
          padding: 0,
          animationIn: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          animationOut: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          slideTransitionOut: {
            type: 'fade',
            duration: 400,
            delay: 50,
            easing: 'ease',
          } as AnimationConfig,
        },
        contentText: {
          constraints: {} as Constraints,
          size: {} as SizeWithUnits,
          style: {} as never,
          padding: 0,
          animationIn: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          animationOut: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          slideTransitionOut: {
            type: 'slide-up',
            duration: 300,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
        },
      }
      // mainText: 450, contentText: 300
      expect(calculateMaxSlideTransitionOutDuration(config)).toBe(450)
    })
  })

  describe('calculateMaxSlideTransitionInDuration', () => {
    it('returns 250 (default) for undefined config', () => {
      expect(calculateMaxSlideTransitionInDuration(undefined)).toBe(250)
    })

    it('returns 250 when no slideTransitionIn configured', () => {
      const config = {
        background: { type: 'color' as const, color: '#000', opacity: 1 },
        mainText: {
          constraints: {} as Constraints,
          size: {} as SizeWithUnits,
          style: {} as never,
          padding: 0,
          animationIn: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          animationOut: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
        },
      }
      expect(calculateMaxSlideTransitionInDuration(config)).toBe(250)
    })

    it('returns max slideTransitionIn duration', () => {
      const config = {
        background: { type: 'color' as const, color: '#000', opacity: 1 },
        referenceText: {
          constraints: {} as Constraints,
          size: {} as SizeWithUnits,
          style: {} as never,
          animationIn: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          animationOut: {
            type: 'none',
            duration: 0,
            delay: 0,
            easing: 'ease',
          } as AnimationConfig,
          slideTransitionIn: {
            type: 'fade',
            duration: 500,
            delay: 100,
            easing: 'ease',
          } as AnimationConfig,
        },
      }
      expect(calculateMaxSlideTransitionInDuration(config)).toBe(600)
    })
  })
})

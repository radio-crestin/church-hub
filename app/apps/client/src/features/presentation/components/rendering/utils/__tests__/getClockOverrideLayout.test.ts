import { describe, expect, it } from 'vitest'

import type { ClockElementConfig, ClockOverride } from '../../../../types'
import { getDefaultClockConfig } from '../../../../utils/defaultConfigs'
import {
  CLOCK_BEHIND_TEXT_OPACITY,
  getClockOverrideLayout,
} from '../getClockOverrideLayout'

const OVERRIDE: ClockOverride = { fontFamily: 'Times New Roman', fontSize: 140 }

function hiddenClock(
  overrides: Partial<ClockElementConfig> = {},
): ClockElementConfig {
  const clock = getDefaultClockConfig()
  return {
    ...clock,
    hidden: true,
    style: {
      ...clock.style,
      fontFamily: 'system-ui',
      maxFontSize: 32,
      color: '#ffcc00',
      bold: false,
      shadow: true,
      alignment: 'left',
      verticalAlignment: 'bottom',
    },
    ...overrides,
  }
}

describe('getClockOverrideLayout', () => {
  it("uses the override's font and size in place of the screen's", () => {
    const { style } = getClockOverrideLayout(
      OVERRIDE,
      hiddenClock(),
      1920,
      1080,
      false,
    )

    expect(style.fontFamily).toBe('Times New Roman')
    expect(style.maxFontSize).toBe(140)
    expect(style.alignment).toBe('right')
    expect(style.verticalAlignment).toBe('top')
  })

  it("keeps the screen clock's colour and shadow even when it is hidden", () => {
    const { style } = getClockOverrideLayout(
      OVERRIDE,
      hiddenClock(),
      1920,
      1080,
      false,
    )

    expect(style.color).toBe('#ffcc00')
    expect(style.shadow).toBe(true)
  })

  it("is bold whatever the screen clock's weight", () => {
    expect(
      getClockOverrideLayout(OVERRIDE, hiddenClock(), 1920, 1080, false).style
        .bold,
    ).toBe(true)
    expect(
      getClockOverrideLayout(OVERRIDE, undefined, 1920, 1080, false).style.bold,
    ).toBe(true)
  })

  it('falls back to the default clock style when the screen has no clock', () => {
    const { style, showSeconds } = getClockOverrideLayout(
      OVERRIDE,
      undefined,
      1920,
      1080,
      false,
    )

    expect(style.color).toBe(getDefaultClockConfig().style.color)
    expect(showSeconds).toBe(false)
  })

  it('fades while text is drawn over it and is solid otherwise', () => {
    const behindText = getClockOverrideLayout(
      OVERRIDE,
      hiddenClock(),
      1920,
      1080,
      true,
    )
    const alone = getClockOverrideLayout(
      OVERRIDE,
      hiddenClock(),
      1920,
      1080,
      false,
    )

    expect(behindText.opacity).toBe(CLOCK_BEHIND_TEXT_OPACITY)
    expect(behindText.opacity).toBeGreaterThanOrEqual(0.3)
    expect(behindText.opacity).toBeLessThanOrEqual(0.4)
    expect(alone.opacity).toBe(1)
  })

  it('anchors the box to the top-right corner inside the screen', () => {
    const { bounds } = getClockOverrideLayout(
      OVERRIDE,
      hiddenClock(),
      1920,
      1080,
      false,
    )

    expect(bounds.y).toBeCloseTo(1080 * 0.02)
    expect(bounds.x + bounds.width).toBeCloseTo(1920 * 0.98)
    expect(bounds.x).toBeGreaterThan(1920 / 2)
  })

  it('leaves room for the whole time on one line at the full size', () => {
    const withoutSeconds = getClockOverrideLayout(
      OVERRIDE,
      hiddenClock({ showSeconds: false }),
      1920,
      1080,
      false,
    )
    const withSeconds = getClockOverrideLayout(
      OVERRIDE,
      hiddenClock({ showSeconds: true }),
      1920,
      1080,
      false,
    )

    // "88:88" is about 2.3em wide in Times New Roman, "88:88:88" about 3.6em.
    expect(withoutSeconds.bounds.width).toBeGreaterThan(2.3 * 140)
    expect(withSeconds.bounds.width).toBeGreaterThan(3.6 * 140)
    expect(withSeconds.showSeconds).toBe(true)
    // One line of text plus the rounding a scaled-down preview adds.
    expect(withoutSeconds.bounds.height).toBeGreaterThan(
      withoutSeconds.style.lineHeight * 140,
    )
  })

  it('lets the clock scale down with the preview instead of stopping at a floor', () => {
    const { style } = getClockOverrideLayout(
      OVERRIDE,
      hiddenClock(),
      1920,
      1080,
      false,
    )

    expect(style.minFontSize).toBeLessThanOrEqual(1)
  })

  it('keeps the box on a screen too small for the clock', () => {
    const { bounds } = getClockOverrideLayout(
      OVERRIDE,
      hiddenClock({ showSeconds: true }),
      640,
      160,
      false,
    )

    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(640)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(160)
  })
})

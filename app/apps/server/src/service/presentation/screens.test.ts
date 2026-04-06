import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseNextSlideConfig } from './screens'
import { describe, expect, it } from 'bun:test'

// Load fixture data to test against real screen configs
const fixturesPath = join(
  import.meta.dir,
  '../../db/fixtures/default-screens.json',
)
const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8')) as Array<{
  name: string
  nextSlideConfig?: Record<string, unknown>
}>

describe('parseNextSlideConfig', () => {
  it('returns defaults for invalid JSON', () => {
    const result = parseNextSlideConfig('not json')
    expect(result.labelStyle).toBeDefined()
    expect(result.labelStyle.maxFontSize).toBe(24)
    expect(result.contentStyle).toBeDefined()
    expect(result.contentStyle.maxFontSize).toBe(32)
    expect(result.background).toBeDefined()
  })

  it('returns defaults for empty JSON object', () => {
    const result = parseNextSlideConfig('{}')
    expect(result.labelStyle).toBeDefined()
    expect(result.labelStyle.maxFontSize).toBe(24)
    expect(result.contentStyle).toBeDefined()
    expect(result.contentStyle.maxFontSize).toBe(32)
    expect(result.enabled).toBe(true)
  })

  it('merges labelStyle with defaults when labelStyle is missing', () => {
    const config = {
      enabled: true,
      labelText: 'Next:',
      // labelStyle intentionally omitted — simulates old database entry
    }
    const result = parseNextSlideConfig(JSON.stringify(config))
    expect(result.labelStyle).toBeDefined()
    expect(result.labelStyle.maxFontSize).toBe(24)
    expect(result.labelStyle.bold).toBe(true)
    expect(result.labelText).toBe('Next:')
  })

  it('merges contentStyle with defaults when contentStyle is missing', () => {
    const config = {
      enabled: true,
      // contentStyle intentionally omitted — simulates old database entry
    }
    const result = parseNextSlideConfig(JSON.stringify(config))
    expect(result.contentStyle).toBeDefined()
    expect(result.contentStyle.maxFontSize).toBe(32)
    expect(result.contentStyle.autoScale).toBe(true)
  })

  it('merges background with defaults when background is missing', () => {
    const config = { enabled: false }
    const result = parseNextSlideConfig(JSON.stringify(config))
    expect(result.background).toBeDefined()
    expect(result.background.type).toBe('color')
  })

  it('preserves custom labelStyle values while filling missing fields', () => {
    const config = {
      labelStyle: {
        maxFontSize: 48,
        color: '#ff0000',
      },
    }
    const result = parseNextSlideConfig(JSON.stringify(config))
    expect(result.labelStyle.maxFontSize).toBe(48)
    expect(result.labelStyle.color).toBe('#ff0000')
    // Default fields should be filled in
    expect(result.labelStyle.fontFamily).toBe('system-ui')
    expect(result.labelStyle.bold).toBe(true)
  })

  it('preserves custom contentStyle values while filling missing fields', () => {
    const config = {
      contentStyle: {
        maxFontSize: 64,
        alignment: 'center',
      },
    }
    const result = parseNextSlideConfig(JSON.stringify(config))
    expect(result.contentStyle.maxFontSize).toBe(64)
    expect(result.contentStyle.alignment).toBe('center')
    // Default fields should be filled in
    expect(result.contentStyle.fontFamily).toBe('system-ui')
  })

  // Test against actual fixture data to catch fixture/schema drift
  describe('fixture validation', () => {
    for (const fixture of fixtures) {
      if (!fixture.nextSlideConfig) continue

      it(`parses ${fixture.name} fixture nextSlideConfig correctly`, () => {
        const json = JSON.stringify(fixture.nextSlideConfig)
        const result = parseNextSlideConfig(json)

        expect(result.labelStyle).toBeDefined()
        expect(typeof result.labelStyle.maxFontSize).toBe('number')
        expect(result.labelStyle.maxFontSize).toBeGreaterThan(0)

        expect(result.contentStyle).toBeDefined()
        expect(typeof result.contentStyle.maxFontSize).toBe('number')
        expect(result.contentStyle.maxFontSize).toBeGreaterThan(0)

        expect(result.background).toBeDefined()
        expect(result.background.type).toBe('color')

        expect(typeof result.enabled).toBe('boolean')
        expect(typeof result.labelText).toBe('string')
      })
    }
  })

  it('handles config with both labelStyle and contentStyle missing (old DB format)', () => {
    const oldConfig = {
      enabled: true,
      constraints: {
        top: { enabled: true, value: 78, unit: '%' },
        right: { enabled: true, value: 0, unit: '%' },
        bottom: { enabled: true, value: 0, unit: '%' },
        left: { enabled: true, value: 0, unit: '%' },
      },
      size: { width: 100, widthUnit: '%', height: 22, heightUnit: '%' },
      labelText: 'Urmeaza:',
      background: { type: 'color', color: '#1a1a1a', opacity: 0.8 },
      // No labelStyle or contentStyle — this is the bug scenario
    }
    const result = parseNextSlideConfig(JSON.stringify(oldConfig))

    // Should not crash and should have valid styles
    expect(result.labelStyle).toBeDefined()
    expect(result.labelStyle.maxFontSize).toBe(24)
    expect(result.contentStyle).toBeDefined()
    expect(result.contentStyle.maxFontSize).toBe(32)

    // Should preserve the provided fields
    expect(result.enabled).toBe(true)
    expect(result.labelText).toBe('Urmeaza:')
    expect(result.background.color).toBe('#1a1a1a')
    expect(result.background.opacity).toBe(0.8)
  })
})

import { getDefaultContentConfig } from './getDefaultContentConfig'
import { getDefaultGlobalSettings } from './getDefaultGlobalSettings'
import { describe, expect, it } from 'bun:test'
import { contentTypes } from '../../../db/schema'
import type { ScreenType } from '../types'

const SCREEN_TYPES: ScreenType[] = ['primary', 'stage', 'livestream', 'kiosk']
const BUNDLED_FONTS = ['Source Sans 3', 'Montserrat']

interface Edge {
  enabled: boolean
  value: number
}
interface Element {
  constraints: { top: Edge; right: Edge; bottom: Edge; left: Edge }
  style?: { fontFamily: string }
  hidden?: boolean
}

function textElements(config: Record<string, unknown>): [string, Element][] {
  return Object.entries(config).filter(
    ([, value]) =>
      typeof value === 'object' &&
      value !== null &&
      'constraints' in value &&
      'style' in value,
  ) as [string, Element][]
}

function rect({ constraints: c }: Element) {
  return {
    top: c.top.value,
    bottom: 100 - c.bottom.value,
    left: c.left.value,
    right: 100 - c.right.value,
  }
}

function overlaps(a: Element, b: Element) {
  const r1 = rect(a)
  const r2 = rect(b)
  return (
    r1.left < r2.right &&
    r2.left < r1.right &&
    r1.top < r2.bottom &&
    r2.top < r1.bottom
  )
}

describe('factory slide design', () => {
  for (const screenType of SCREEN_TYPES) {
    for (const contentType of contentTypes) {
      const config = getDefaultContentConfig(contentType, screenType)

      it(`${screenType} ${contentType}: every text box sits on screen in a bundled font`, () => {
        expect(config.background).toBeDefined()
        for (const [, element] of textElements(config)) {
          const box = rect(element)
          expect(box.top).toBeGreaterThanOrEqual(0)
          expect(box.left).toBeGreaterThanOrEqual(0)
          expect(box.bottom).toBeLessThanOrEqual(100)
          expect(box.right).toBeLessThanOrEqual(100)
          expect(box.bottom).toBeGreaterThan(box.top)
          expect(box.right).toBeGreaterThan(box.left)
          expect(BUNDLED_FONTS).toContain(element.style?.fontFamily ?? '')
        }
      })

      it(`${screenType} ${contentType}: visible elements and the clock never overlap`, () => {
        const visible = textElements(config)
          .filter(([, element]) => !element.hidden)
          .map(([, element]) => element)
        if (config.clockEnabled) {
          visible.push(
            getDefaultGlobalSettings(screenType)
              .clockConfig as unknown as Element,
          )
        }
        // A song config carries the key and the "Amin" too, but each shows on
        // its own slide (first / last) — compare the elements a slide shows.
        const shownTogether =
          contentType === 'song'
            ? visible.filter((element) => element !== config.amen)
            : visible
        for (const [i, a] of shownTogether.entries()) {
          for (const b of shownTogether.slice(i + 1)) {
            expect(overlaps(a, b)).toBe(false)
          }
        }
      })
    }
  }

  it('makes the livestream a transparent overlay without the song key', () => {
    const song = getDefaultContentConfig('song', 'livestream')
    expect(song.background).toEqual({ type: 'transparent', opacity: 1 })
    expect(song.displayKeyLine).toBe(false)
  })
})

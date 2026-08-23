import { describe, expect, it } from 'vitest'

import { attachRepetitionMarkers } from '../attachRepetitionMarkers'

const NBSP = '\u00a0'

describe('attachRepetitionMarkers', () => {
  it('glues a trailing closer to the last word', () => {
    expect(attachRepetitionMarkers('/: Slavă Ție  :/')).toBe(
      `/: Slavă Ție${NBSP}:/`,
    )
  })

  it('handles the double-slash form', () => {
    expect(attachRepetitionMarkers('//: Cânt Domnului ://')).toBe(
      `//: Cânt Domnului${NBSP}://`,
    )
  })

  it('handles bar markers and repeat counts', () => {
    expect(attachRepetitionMarkers('Aleluia :|')).toBe(`Aleluia${NBSP}:|`)
    expect(attachRepetitionMarkers('Aleluia (x2)')).toBe(`Aleluia${NBSP}(x2)`)
    expect(attachRepetitionMarkers('Aleluia bis')).toBe(`Aleluia${NBSP}bis`)
  })

  it('merges a marker-only line into the line above it', () => {
    expect(attachRepetitionMarkers('/: Slavă Ție\n:/')).toBe(
      `/: Slavă Ție${NBSP}:/`,
    )
    expect(attachRepetitionMarkers('Cânt Domnului\nx2')).toBe(
      `Cânt Domnului${NBSP}x2`,
    )
  })

  it('leaves a leading marker-only line alone', () => {
    expect(attachRepetitionMarkers(':/\nSlavă Ție')).toBe(':/\nSlavă Ție')
  })

  it('only touches the end of a line', () => {
    expect(attachRepetitionMarkers('/: Slavă Ție, Doamne')).toBe(
      '/: Slavă Ție, Doamne',
    )
  })

  it('keeps every other line untouched', () => {
    const lyrics = 'Prima linie\nA doua linie  :/\nA treia linie'
    expect(attachRepetitionMarkers(lyrics)).toBe(
      `Prima linie\nA doua linie${NBSP}:/\nA treia linie`,
    )
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { measureTextHeight } from '../measureTextHeight'

describe('measureTextHeight', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads the laid-out height to the sub-pixel', () => {
    const element = document.createElement('div')
    Object.defineProperty(element, 'scrollHeight', { value: 33 })
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      height: '32.5px',
    } as CSSStyleDeclaration)

    expect(measureTextHeight(element)).toBe(32.5)
  })

  it('keeps scrollHeight for an element that is not laid out', () => {
    const element = document.createElement('div')
    element.style.height = 'auto'
    Object.defineProperty(element, 'scrollHeight', { value: 40 })

    expect(measureTextHeight(element)).toBe(40)
  })
})

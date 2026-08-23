import { describe, expect, it } from 'vitest'

import { isTypingTarget } from '../isTypingTarget'

describe('isTypingTarget', () => {
  it('recognises the elements that take typed text', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('select'))).toBe(true)

    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.appendChild(editable)
    expect(isTypingTarget(editable)).toBe(true)
    editable.remove()
  })

  it('leaves buttons, plain elements and nothing alone', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

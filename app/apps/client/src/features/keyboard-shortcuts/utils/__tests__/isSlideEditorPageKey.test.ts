import { afterEach, describe, expect, it } from 'vitest'

import { isSlideEditorPageKey } from '../isSlideEditorPageKey'

/** Dispatches a keydown on `target` and reports what the check said about it. */
function press(target: Element, init: KeyboardEventInit): boolean {
  let result: boolean | null = null
  const listener = (event: Event) => {
    result = isSlideEditorPageKey(event as KeyboardEvent)
  }
  document.addEventListener('keydown', listener)
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  document.removeEventListener('keydown', listener)
  if (result === null) throw new Error('keydown never reached the document')
  return result
}

function slideEditor(): HTMLElement {
  const editor = document.createElement('div')
  editor.setAttribute('contenteditable', 'true')
  editor.setAttribute('data-slide-navigation', '')
  document.body.appendChild(editor)
  return editor
}

describe('isSlideEditorPageKey', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('lets PageDown and PageUp through from a slide editor', () => {
    const editor = slideEditor()

    expect(press(editor, { key: 'PageDown' })).toBe(true)
    expect(press(editor, { key: 'PageUp' })).toBe(true)
  })

  it('also when the key lands on text inside the editor', () => {
    const line = document.createElement('span')
    slideEditor().appendChild(line)

    expect(press(line, { key: 'PageDown' })).toBe(true)
  })

  it('keeps caret and typing keys with the text', () => {
    const editor = slideEditor()

    for (const key of ['ArrowRight', 'ArrowDown', ' ', 'Home', 'End', 'a']) {
      expect(press(editor, { key })).toBe(false)
    }
  })

  it('keeps a page key with a modifier with the text', () => {
    const editor = slideEditor()

    expect(press(editor, { key: 'PageDown', shiftKey: true })).toBe(false)
    expect(press(editor, { key: 'PageUp', ctrlKey: true })).toBe(false)
  })

  it('ignores editable elements that did not opt in', () => {
    const notes = document.createElement('div')
    notes.setAttribute('contenteditable', 'true')
    document.body.appendChild(notes)

    expect(press(notes, { key: 'PageDown' })).toBe(false)
  })
})

import { afterEach, describe, expect, it } from 'vitest'

import { isDialogKey } from '../isDialogKey'

/** Dispatches a keydown on `target` and reports what the check said about it. */
function press(target: Element, key = 'Escape'): boolean {
  let result: boolean | null = null
  const listener = (event: Event) => {
    result = isDialogKey(event as KeyboardEvent)
  }
  window.addEventListener('keydown', listener)
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
  window.removeEventListener('keydown', listener)
  if (result === null) throw new Error('keydown never reached the window')
  return result
}

function openDialog(): HTMLDialogElement {
  const dialog = document.createElement('dialog')
  dialog.setAttribute('open', '')
  document.body.appendChild(dialog)
  return dialog
}

describe('isDialogKey', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('claims a key pressed inside an open dialog', () => {
    const input = document.createElement('input')
    openDialog().appendChild(input)

    expect(press(input)).toBe(true)
    expect(press(input, 'ArrowDown')).toBe(true)
  })

  it('claims a key pressed on the page while a dialog is open', () => {
    const button = document.createElement('button')
    document.body.appendChild(button)
    openDialog()

    expect(press(button)).toBe(true)
  })

  it('still claims a press that closed its dialog on the way up', () => {
    const dialog = openDialog()
    const input = document.createElement('input')
    dialog.appendChild(input)
    input.addEventListener('keydown', () => dialog.remove())

    expect(press(input)).toBe(true)
    expect(document.querySelector('dialog')).toBeNull()
  })

  it('leaves keys to the page when no dialog is open', () => {
    const button = document.createElement('button')
    document.body.appendChild(button)
    // A closed dialog on the page does not own the keyboard.
    document.body.appendChild(document.createElement('dialog'))

    expect(press(button)).toBe(false)
    expect(press(button, 'ArrowRight')).toBe(false)
  })
})

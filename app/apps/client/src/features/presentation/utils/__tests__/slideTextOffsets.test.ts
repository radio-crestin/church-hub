import { describe, expect, it } from 'vitest'

import {
  domPositionAtOffset,
  elementAtOffset,
  elementsInRange,
  offsetAtDomPosition,
} from '../slideTextOffsets'

/** An editor holding `html`, attached so `TreeWalker` can walk it. */
function editorWith(html: string): HTMLElement {
  const editor = document.createElement('div')
  editor.innerHTML = html
  document.body.append(editor)
  return editor
}

/** The offset of the `index`-th character of `text` inside that text node. */
function textNodeAt(editor: HTMLElement, index: number): Text {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let seen = 0
  let current = walker.nextNode() as Text | null
  while (current) {
    if (seen + (current.data.length ?? 0) > index) return current
    seen += current.data.length
    current = walker.nextNode() as Text | null
  }
  throw new Error(`no text node at ${index}`)
}

describe('slideTextOffsets', () => {
  describe('the two ways the editor is seeded agree', () => {
    // "one\ntwo\nthree" as `innerText` writes it: breaks are elements.
    const asElements = 'one<br>two<br>three'
    // ...and as the styled markup writes it: breaks are real characters.
    const asCharacters = 'one\ntwo\nthree'

    it('counts a break as the one character it is in the text', () => {
      const editor = editorWith(asElements)
      // The "t" that opens the last line is character 8 of "one\ntwo\nthree".
      const node = textNodeAt(editor, 8)
      expect(offsetAtDomPosition(editor, node, 0)).toBe(8)
    })

    it('gives the same offset whichever way the line was seeded', () => {
      const elementSeeded = editorWith(asElements)
      const characterSeeded = editorWith(asCharacters)

      const fromElements = offsetAtDomPosition(
        elementSeeded,
        textNodeAt(elementSeeded, 8),
        5,
      )
      const fromCharacters = offsetAtDomPosition(
        characterSeeded,
        textNodeAt(characterSeeded, 0),
        13,
      )
      expect(fromElements).toBe(13)
      expect(fromCharacters).toBe(13)
    })

    it('reaches the last character of a multi-line selection', () => {
      const editor = editorWith(asElements)
      const last = textNodeAt(editor, 8)
      // End of "three" — the position the old text-node-only walk reported as
      // 11, two short, which is exactly what left the tail unstyled.
      expect(
        offsetAtDomPosition(editor, last, last.textContent?.length ?? 0),
      ).toBe(13)
    })
  })

  describe('boundaries that land on an element', () => {
    it('resolves a position before a child element', () => {
      const editor = editorWith('one<br>two')
      expect(offsetAtDomPosition(editor, editor, 0)).toBe(0)
      // Before the <br>, i.e. the end of the first line.
      expect(offsetAtDomPosition(editor, editor, 1)).toBe(3)
      // Before "two".
      expect(offsetAtDomPosition(editor, editor, 2)).toBe(4)
    })

    it('resolves a position past the last child to the end of the text', () => {
      const editor = editorWith('one<br>two')
      expect(offsetAtDomPosition(editor, editor, 3)).toBe(7)
    })

    it('counts through a styled run without losing its characters', () => {
      const editor = editorWith(
        'a<span style="font-size: 2em;">big</span>b<br>c',
      )
      expect(offsetAtDomPosition(editor, editor, 4)).toBe(6)
    })

    it('rejects a position outside the editor', () => {
      const editor = editorWith('one')
      const outside = document.createElement('div')
      document.body.append(outside)
      expect(offsetAtDomPosition(editor, outside, 0)).toBeNull()
    })
  })

  describe('domPositionAtOffset', () => {
    it('round-trips an offset back to the same place', () => {
      const editor = editorWith('one<br>two<br>three')
      for (const offset of [0, 3, 4, 8, 13]) {
        const position = domPositionAtOffset(editor, offset)
        expect(position).not.toBeNull()
        if (!position) continue
        expect(
          offsetAtDomPosition(editor, position.node, position.offset),
        ).toBe(offset)
      }
    })

    it('lands inside a styled run rather than beside it', () => {
      const editor = editorWith('a<span>big</span>b')
      const position = domPositionAtOffset(editor, 2)
      expect(position?.node.textContent).toBe('big')
      expect(position?.offset).toBe(1)
    })
  })

  describe('elementAtOffset', () => {
    it('reports the run rendering that character, not the slide', () => {
      const editor = editorWith('a<span id="run">big</span>b')
      expect(elementAtOffset(editor, 0)).toBe(editor)
      expect((elementAtOffset(editor, 1) as HTMLElement).id).toBe('run')
      expect(elementAtOffset(editor, 4)).toBe(editor)
    })

    it('is not thrown off by a line break before the run', () => {
      const editor = editorWith('one<br><span id="run">two</span>')
      expect((elementAtOffset(editor, 4) as HTMLElement).id).toBe('run')
    })
  })

  describe('elementsInRange', () => {
    it('collects every run the selection touches', () => {
      const editor = editorWith(
        '<span id="a">one</span><br><span id="b">two</span><span id="c">three</span>',
      )
      const ids = elementsInRange(editor, 0, 9).map((el) => el.id)
      expect(ids).toEqual(['a', 'b', 'c'])
    })

    it('leaves out a run the selection stops short of', () => {
      const editor = editorWith(
        '<span id="a">one</span><span id="b">two</span>',
      )
      expect(elementsInRange(editor, 0, 3).map((el) => el.id)).toEqual(['a'])
    })
  })
})

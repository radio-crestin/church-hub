import { type RefObject, useCallback, useEffect, useState } from 'react'

export interface TextSelectionRange {
  start: number
  end: number
}

export interface UseTextSelectionResult {
  selectedRange: TextSelectionRange | null
  selectedText: string
  hasSelection: boolean
  clearSelection: () => void
}

/**
 * Check if a node is inside a hidden element (aria-hidden="true")
 */
function isNodeHidden(node: Node): boolean {
  let current: Node | null = node
  while (current && current.nodeType !== Node.DOCUMENT_NODE) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as HTMLElement
      if (element.getAttribute('aria-hidden') === 'true') {
        return true
      }
    }
    current = current.parentNode
  }
  return false
}

/**
 * Calculate the character offset from the start of the container
 * to the given node/offset position.
 * Only counts visible text nodes (skips aria-hidden elements).
 */
function getCharacterOffset(
  container: HTMLElement,
  targetNode: Node,
  targetOffset: number,
): number {
  let offset = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)

  let node: Node | null = walker.nextNode()
  while (node) {
    // Skip text nodes inside hidden elements
    if (isNodeHidden(node)) {
      node = walker.nextNode()
      continue
    }

    if (node === targetNode) {
      return offset + targetOffset
    }
    offset += node.textContent?.length ?? 0
    node = walker.nextNode()
  }

  return offset
}

/**
 * Hook to track text selection within a container element
 * Returns the selected text and character offsets relative to the container
 */
export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>,
): UseTextSelectionResult {
  const [selectedRange, setSelectedRange] = useState<TextSelectionRange | null>(
    null,
  )
  const [selectedText, setSelectedText] = useState('')

  const updateSelection = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      setSelectedRange(null)
      setSelectedText('')
      return
    }

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelectedRange(null)
      setSelectedText('')
      return
    }

    const range = selection.getRangeAt(0)
    const text = selection.toString().trim()

    if (!text) {
      setSelectedRange(null)
      setSelectedText('')
      return
    }

    // Check if selection is within our container
    if (
      !container.contains(range.startContainer) ||
      !container.contains(range.endContainer)
    ) {
      setSelectedRange(null)
      setSelectedText('')
      return
    }

    // Calculate character offsets
    const startOffset = getCharacterOffset(
      container,
      range.startContainer,
      range.startOffset,
    )
    const endOffset = getCharacterOffset(
      container,
      range.endContainer,
      range.endOffset,
    )

    setSelectedRange({
      start: Math.min(startOffset, endOffset),
      end: Math.max(startOffset, endOffset),
    })
    setSelectedText(text)
  }, [containerRef])

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges()
    setSelectedRange(null)
    setSelectedText('')
  }, [])

  useEffect(() => {
    // Listen for selection changes
    document.addEventListener('selectionchange', updateSelection)

    return () => {
      document.removeEventListener('selectionchange', updateSelection)
    }
  }, [updateSelection])

  return {
    selectedRange,
    selectedText,
    hasSelection: selectedRange !== null && selectedText.length > 0,
    clearSelection,
  }
}

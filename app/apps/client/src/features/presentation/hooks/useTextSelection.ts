import { type RefObject, useCallback, useEffect, useRef } from 'react'

export interface TextSelectionRange {
  start: number
  end: number
}

export interface UseTextSelectionResult {
  /** Get the current selected range (reads from ref, no re-render) */
  getSelectedRange: () => TextSelectionRange | null
  /** Get the current selected text (reads from ref, no re-render) */
  getSelectedText: () => string
  /** Check if there's an active selection (reads from ref, no re-render) */
  hasSelection: () => boolean
  /** Clear the selection */
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
 * Hook to track text selection within a container element.
 * Returns getter functions instead of state to avoid triggering re-renders
 * when selection changes. This prevents DOM replacement which would clear
 * the native browser selection.
 *
 * Use getSelectedRange(), getSelectedText(), hasSelection() to read current values.
 * These read from refs directly and don't cause re-renders.
 */
export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>,
): UseTextSelectionResult {
  // Store selection in refs to avoid triggering re-renders
  // Re-renders cause DOM replacement which clears the native selection
  const capturedRangeRef = useRef<TextSelectionRange | null>(null)
  const capturedTextRef = useRef<string>('')

  // Capture the current selection and store in refs
  const captureSelection = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      return null
    }

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return null
    }

    const range = selection.getRangeAt(0)
    const text = selection.toString().trim()

    if (!text) {
      return null
    }

    // Check if selection is within our container
    if (
      !container.contains(range.startContainer) ||
      !container.contains(range.endContainer)
    ) {
      return null
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

    return {
      range: {
        start: Math.min(startOffset, endOffset),
        end: Math.max(startOffset, endOffset),
      },
      text,
    }
  }, [containerRef])

  // Getter functions - read from refs without triggering re-renders
  const getSelectedRange = useCallback(() => capturedRangeRef.current, [])

  const getSelectedText = useCallback(() => capturedTextRef.current, [])

  const hasSelection = useCallback(
    () =>
      capturedRangeRef.current !== null && capturedTextRef.current.length > 0,
    [],
  )

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges()
    capturedRangeRef.current = null
    capturedTextRef.current = ''
  }, [])

  useEffect(() => {
    // Capture selection immediately on change - no debounce needed
    // since we're only updating refs (no re-renders)
    const handleSelectionChange = () => {
      const captured = captureSelection()

      if (captured) {
        // Valid selection - store in refs
        capturedRangeRef.current = captured.range
        capturedTextRef.current = captured.text
      }
      // If captured is null but we have existing capture, KEEP IT
      // This preserves selection when DOM changes clear the native selection
      // Only clear on explicit clearSelection() call
    }

    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [captureSelection])

  return {
    getSelectedRange,
    getSelectedText,
    hasSelection,
    clearSelection,
  }
}

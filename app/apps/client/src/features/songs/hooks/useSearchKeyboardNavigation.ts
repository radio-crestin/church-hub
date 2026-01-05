import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSearchKeyboardNavigationOptions {
  itemCount: number
  onSelect: (index: number) => void
  enabled?: boolean
}

interface UseSearchKeyboardNavigationReturn {
  selectedIndex: number
  setSelectedIndex: (index: number) => void
  handleKeyDown: (event: React.KeyboardEvent) => void
  itemRefs: React.MutableRefObject<Map<number, HTMLElement>>
}

export function useSearchKeyboardNavigation({
  itemCount,
  onSelect,
  enabled = true,
}: UseSearchKeyboardNavigationOptions): UseSearchKeyboardNavigationReturn {
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map())

  // Reset selection when item count changes (new search results)
  useEffect(() => {
    setSelectedIndex(-1)
  }, [itemCount])

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0) {
      const element = itemRefs.current.get(selectedIndex)
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!enabled || itemCount === 0) return

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault()
          setSelectedIndex((prev) => {
            const next = prev < itemCount - 1 ? prev + 1 : prev
            return next
          })
          break
        }

        case 'ArrowUp': {
          event.preventDefault()
          setSelectedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : prev
            return next
          })
          break
        }

        case 'Enter': {
          if (selectedIndex >= 0) {
            event.preventDefault()
            onSelect(selectedIndex)
          }
          // If no selection, let the event bubble for search trigger
          break
        }

        case 'Escape': {
          if (selectedIndex >= 0) {
            event.preventDefault()
            setSelectedIndex(-1)
          }
          break
        }
      }
    },
    [enabled, itemCount, selectedIndex, onSelect],
  )

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    itemRefs,
  }
}

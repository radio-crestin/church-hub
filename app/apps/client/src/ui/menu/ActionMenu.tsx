import { Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * A single row in the menu. `active` turns the row into a toggle
 * (`menuitemcheckbox`) so switches like "bookmark" keep their on/off meaning
 * once they lose their standalone coloured button.
 */
export interface ActionMenuItem {
  id: string
  label: string
  /** Short "what does this do" line under the label. */
  description?: string
  icon: React.ReactNode
  /** Tailwind classes for the icon chip — keeps each action's colour cue. */
  iconClassName?: string
  onSelect: () => void
  disabled?: boolean
  active?: boolean
  testId?: string
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  /** Visible trigger label, e.g. "Actions". */
  label: string
  triggerIcon?: React.ReactNode
  testId?: string
  className?: string
  /** Which trigger edge the panel lines up with. */
  align?: 'start' | 'end'
}

const PANEL_MIN_WIDTH = 264
const ESTIMATED_ROW_HEIGHT = 56

/** Menus opened from inside a <dialog> must portal into it or they render behind. */
function getPortalContainer(element: HTMLElement | null): HTMLElement {
  let current = element
  while (current) {
    if (current.tagName === 'DIALOG') return current
    current = current.parentElement
  }
  return document.body
}

export function ActionMenu({
  items,
  label,
  triggerIcon,
  testId,
  className,
  align = 'end',
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [position, setPosition] = useState<{
    top?: number
    bottom?: number
    left: number
    minWidth: number
  }>({ left: 0, minWidth: PANEL_MIN_WIDTH })

  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()

  const enabledIndexes = items
    .map((item, index) => (item.disabled ? -1 : index))
    .filter((index) => index >= 0)

  const close = useCallback((focusTrigger = true) => {
    setIsOpen(false)
    setActiveIndex(-1)
    if (focusTrigger) buttonRef.current?.focus()
  }, [])

  const updatePosition = useCallback(() => {
    const trigger = buttonRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const panelHeight = Math.min(items.length * ESTIMATED_ROW_HEIGHT + 16, 420)
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < panelHeight && rect.top > spaceBelow
    const minWidth = Math.max(PANEL_MIN_WIDTH, rect.width)

    // Keep the panel on screen on narrow viewports instead of letting it
    // overflow past the right edge.
    const preferredLeft =
      align === 'end'
        ? rect.right + window.scrollX - minWidth
        : rect.left + window.scrollX
    const maxLeft = window.scrollX + window.innerWidth - minWidth - 8
    const left = Math.max(window.scrollX + 8, Math.min(preferredLeft, maxLeft))

    setPosition(
      openUpward
        ? { bottom: window.innerHeight - rect.top + 6, left, minWidth }
        : { top: rect.bottom + window.scrollY + 6, left, minWidth },
    )
  }, [align, items.length])

  useEffect(() => {
    if (!isOpen) return

    updatePosition()

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      close(false)
    }

    function handleReposition() {
      updatePosition()
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOpen, updatePosition, close])

  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      itemRefs.current[activeIndex]?.focus()
    }
  }, [isOpen, activeIndex])

  const open = (focusIndex: number) => {
    setIsOpen(true)
    setActiveIndex(focusIndex)
  }

  const moveFocus = (delta: number) => {
    if (enabledIndexes.length === 0) return
    const currentPosition = enabledIndexes.indexOf(activeIndex)
    const nextPosition =
      currentPosition === -1
        ? delta > 0
          ? 0
          : enabledIndexes.length - 1
        : (currentPosition + delta + enabledIndexes.length) %
          enabledIndexes.length
    setActiveIndex(enabledIndexes[nextPosition])
  }

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault()
      // Pages bind their own arrow/Escape shortcuts (next slide, back to the
      // list). While the menu has the keyboard, it keeps those keys to itself.
      event.stopPropagation()
      open(enabledIndexes[0] ?? -1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      open(enabledIndexes[enabledIndexes.length - 1] ?? -1)
    }
  }

  // An open menu owns the navigation keys. The capture phase matters: the song
  // and Bible pages listen for Escape and the arrows on the document, and
  // without this a press to close the menu also navigated the page away.
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      const handled = [
        'ArrowDown',
        'ArrowUp',
        'Home',
        'End',
        'Escape',
        'Tab',
      ].includes(event.key)
      if (!handled) return

      if (event.key !== 'Tab') event.preventDefault()
      event.stopPropagation()

      switch (event.key) {
        case 'ArrowDown':
          moveFocus(1)
          break
        case 'ArrowUp':
          moveFocus(-1)
          break
        case 'Home':
          setActiveIndex(enabledIndexes[0] ?? -1)
          break
        case 'End':
          setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? -1)
          break
        case 'Escape':
          close()
          break
        case 'Tab':
          close(false)
          break
        default:
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  })

  const handleSelect = (item: ActionMenuItem) => {
    if (item.disabled) return
    close()
    item.onSelect()
  }

  if (items.length === 0) return null

  const panel = (
    <div
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label={label}
      data-testid={testId ? `${testId}-panel` : undefined}
      className="fixed z-50 max-h-[70vh] overflow-y-auto scrollbar-thin rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl py-1.5"
      style={{
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        minWidth: position.minWidth,
        maxWidth: 'calc(100vw - 1rem)',
      }}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          ref={(element) => {
            itemRefs.current[index] = element
          }}
          role={item.active === undefined ? 'menuitem' : 'menuitemcheckbox'}
          aria-checked={item.active === undefined ? undefined : item.active}
          disabled={item.disabled}
          data-testid={item.testId}
          tabIndex={index === activeIndex ? 0 : -1}
          onClick={() => handleSelect(item)}
          onMouseEnter={() => !item.disabled && setActiveIndex(index)}
          className="w-full flex items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60 focus:bg-gray-50 dark:focus:bg-gray-700/60 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
        >
          <span
            className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg inline-flex items-center justify-center ${
              item.iconClassName ??
              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {item.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">
              {item.label}
            </span>
            {item.description && (
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {item.description}
              </span>
            )}
          </span>
          {item.active && (
            <Check className="shrink-0 mt-2 w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          )}
        </button>
      ))}
    </div>
  )

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex ${className ?? ''}`}
    >
      <button
        ref={buttonRef}
        type="button"
        data-testid={testId}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => (isOpen ? close(false) : open(-1))}
        onKeyDown={handleTriggerKeyDown}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          isOpen
            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-200'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        {triggerIcon}
        <span>{label}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && createPortal(panel, getPortalContainer(buttonRef.current))}
    </div>
  )
}

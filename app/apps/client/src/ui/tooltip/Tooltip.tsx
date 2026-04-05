import { type ReactNode, useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

const arrowPositionStyles = {
  top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-t-gray-900 dark:border-t-gray-700 border-x-transparent border-b-transparent',
  bottom:
    'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-b-gray-900 dark:border-b-gray-700 border-x-transparent border-t-transparent',
  left: 'right-0 top-1/2 -translate-y-1/2 translate-x-full border-l-gray-900 dark:border-l-gray-700 border-y-transparent border-r-transparent',
  right:
    'left-0 top-1/2 -translate-y-1/2 -translate-x-full border-r-gray-900 dark:border-r-gray-700 border-y-transparent border-l-transparent',
}

function getPortalContainer(element: HTMLElement | null): HTMLElement {
  let current = element
  while (current) {
    if (current.tagName === 'DIALOG') return current
    current = current.parentElement
  }
  return document.body
}

export function Tooltip({
  content,
  children,
  position = 'top',
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  const show = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const gap = 8

    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = rect.top - gap
        left = rect.left + rect.width / 2
        break
      case 'bottom':
        top = rect.bottom + gap
        left = rect.left + rect.width / 2
        break
      case 'left':
        top = rect.top + rect.height / 2
        left = rect.left - gap
        break
      case 'right':
        top = rect.top + rect.height / 2
        left = rect.right + gap
        break
    }

    setCoords({ top, left })
    setIsVisible(true)
  }, [position])

  const transformOrigin = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0%)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0%, -50%)',
  }

  const portalTarget = getPortalContainer(triggerRef.current)

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={show}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible &&
        createPortal(
          <div
            className="fixed pointer-events-none"
            style={{
              top: coords.top,
              left: coords.left,
              transform: transformOrigin[position],
              zIndex: 99999,
            }}
          >
            <div className="px-3 py-1.5 text-sm font-medium text-white dark:text-gray-100 bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg whitespace-nowrap">
              {content}
            </div>
            <div
              className={`absolute w-0 h-0 border-4 ${arrowPositionStyles[position]}`}
            />
          </div>,
          portalTarget,
        )}
    </div>
  )
}

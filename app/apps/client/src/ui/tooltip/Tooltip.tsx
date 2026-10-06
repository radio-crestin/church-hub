import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import {
  placeTooltip,
  type TooltipPlacement,
  type TooltipSide,
} from './placeTooltip'

interface TooltipProps {
  content: string
  children: ReactNode
  /** The side it prefers; it flips and slides on its own to stay in the window. */
  position?: TooltipSide
  className?: string
}

const arrowSideStyles: Record<TooltipSide, string> = {
  top: 'top-full border-t-gray-900 dark:border-t-gray-700 border-x-transparent border-b-transparent',
  bottom:
    'bottom-full border-b-gray-900 dark:border-b-gray-700 border-x-transparent border-t-transparent',
  left: 'left-full border-l-gray-900 dark:border-l-gray-700 border-y-transparent border-r-transparent',
  right:
    'right-full border-r-gray-900 dark:border-r-gray-700 border-y-transparent border-l-transparent',
}

function arrowStyle({ side, arrowOffset }: TooltipPlacement): CSSProperties {
  return side === 'top' || side === 'bottom'
    ? { left: arrowOffset, transform: 'translateX(-50%)' }
    : { top: arrowOffset, transform: 'translateY(-50%)' }
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
  const [placement, setPlacement] = useState<TooltipPlacement | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Measured before paint: the tooltip is first laid out hidden, then placed
  // where its real size fits inside the window.
  useLayoutEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return
    const tooltip = tooltipRef.current.getBoundingClientRect()
    setPlacement(
      placeTooltip(
        position,
        triggerRef.current.getBoundingClientRect(),
        { width: tooltip.width, height: tooltip.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    )
  }, [isVisible, position, content])

  const hide = () => {
    setIsVisible(false)
    setPlacement(null)
  }

  const portalTarget = getPortalContainer(triggerRef.current)

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={hide}
    >
      {children}
      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className="fixed pointer-events-none w-max max-w-[calc(100vw-16px)]"
            style={{
              top: placement?.top ?? 0,
              left: placement?.left ?? 0,
              visibility: placement ? 'visible' : 'hidden',
              zIndex: 99999,
            }}
          >
            <div className="px-3 py-1.5 text-sm font-medium text-white dark:text-gray-100 bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg break-words">
              {content}
            </div>
            {placement && (
              <div
                data-testid="tooltip-arrow"
                className={`absolute w-0 h-0 border-4 ${arrowSideStyles[placement.side]}`}
                style={arrowStyle(placement)}
              />
            )}
          </div>,
          portalTarget,
        )}
    </div>
  )
}

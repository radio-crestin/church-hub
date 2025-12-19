import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { SelectedElement } from './hooks/useEditorState'
import type {
  Constraints,
  ContentType,
  ScreenWithConfigs,
  SizeWithUnits,
} from '../../types'
import { TextContent } from '../rendering/TextContent'
import {
  calculatePixelBounds,
  getBackgroundCSS,
  getTextStyleCSS,
} from '../rendering/utils/styleUtils'

interface ScreenEditorCanvasProps {
  screen: ScreenWithConfigs
  contentType: ContentType
  selectedElement: SelectedElement
  zoom: number
  onSelectElement: (element: SelectedElement) => void
  onUpdateElement: (
    elementType: string,
    updates: { constraints?: Constraints; size?: SizeWithUnits },
  ) => void
}

// Sample content for preview
const SAMPLE_CONTENT: Record<
  ContentType,
  { main?: string; reference?: string; person?: string }
> = {
  song: {
    main: 'Aleluia, Aleluia!\nMărire Domnului!\nAleluia, Aleluia!\nSlăvit să fie El!',
  },
  bible: {
    reference: 'Ioan 3:16',
    main: 'Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu, pentru ca oricine crede în El să nu piară, ci să aibă viață veșnică.',
  },
  bible_passage: {
    reference: 'Psalmul 23:1-3',
    main: 'Domnul este Păstorul meu: nu voi duce lipsă de nimic. El mă paște în pășuni verzi și mă duce la ape de odihnă; îmi înviorează sufletul.',
  },
  announcement: {
    main: '<h1>Anunț Important</h1><p>Program special duminica viitoare!</p>',
  },
  versete_tineri: {
    person: 'Andrei Popescu',
    reference: 'Romani 8:28',
    main: 'De altă parte, știm că toate lucrurile lucrează împreună spre binele celor ce iubesc pe Dumnezeu.',
  },
  empty: {},
}

interface DraggableElementProps {
  x: number
  y: number
  width: number
  height: number
  constraints: Constraints
  size: SizeWithUnits
  isSelected: boolean
  onClick: () => void
  onConstraintChange: (constraints: Constraints) => void
  onSizeChange: (size: SizeWithUnits) => void
  canvasWidth: number
  canvasHeight: number
  screenWidth: number
  screenHeight: number
  canvasRef: React.RefObject<HTMLDivElement | null>
  children: React.ReactNode
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'se' | 'sw' | 'ne' | 'nw' | null

function DraggableElement({
  x,
  y,
  width,
  height,
  constraints,
  size,
  isSelected,
  onClick,
  onConstraintChange,
  onSizeChange,
  canvasWidth,
  canvasHeight,
  screenWidth,
  screenHeight,
  canvasRef,
  children,
}: DraggableElementProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x, y })
  const [isResizing, setIsResizing] = useState<ResizeHandle>(null)
  const [currentSize, setCurrentSize] = useState({ width, height })
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    posX: 0,
    posY: 0,
  })

  const scale = canvasWidth / screenWidth

  useEffect(() => {
    setPosition({ x, y })
  }, [x, y])

  useEffect(() => {
    setCurrentSize({ width, height })
  }, [width, height])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClick()

      const canvasRect = canvasRef.current?.getBoundingClientRect()
      if (!canvasRect) return

      const mouseX = e.clientX - canvasRect.left
      const mouseY = e.clientY - canvasRect.top

      setIsDragging(true)
      setDragStart({ x: mouseX - position.x, y: mouseY - position.y })
    },
    [onClick, position, canvasRef],
  )

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      e.stopPropagation()
      e.preventDefault()
      setIsResizing(handle)
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: currentSize.width,
        height: currentSize.height,
        posX: position.x,
        posY: position.y,
      })
    },
    [currentSize, position],
  )

  // Convert pixel value to constraint value based on unit
  const toConstraintValue = useCallback(
    (pixelValue: number, unit: '%' | 'px', total: number) => {
      return unit === '%' ? (pixelValue / total) * 100 : pixelValue
    },
    [],
  )

  // Handle dragging - update enabled constraints
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      if (!canvasRect) return

      const mouseX = e.clientX - canvasRect.left
      const mouseY = e.clientY - canvasRect.top

      const newX = mouseX - dragStart.x
      const newY = mouseY - dragStart.y
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)

      // Convert canvas position to screen position
      const screenX = position.x / scale
      const screenY = position.y / scale
      const screenW = currentSize.width / scale
      const screenH = currentSize.height / scale

      // Update constraints based on which are enabled
      const newConstraints = { ...constraints }

      if (constraints.left.enabled) {
        newConstraints.left = {
          ...constraints.left,
          value: toConstraintValue(screenX, constraints.left.unit, screenWidth),
        }
      }
      if (constraints.right.enabled) {
        newConstraints.right = {
          ...constraints.right,
          value: toConstraintValue(
            screenWidth - screenX - screenW,
            constraints.right.unit,
            screenWidth,
          ),
        }
      }
      if (constraints.top.enabled) {
        newConstraints.top = {
          ...constraints.top,
          value: toConstraintValue(screenY, constraints.top.unit, screenHeight),
        }
      }
      if (constraints.bottom.enabled) {
        newConstraints.bottom = {
          ...constraints.bottom,
          value: toConstraintValue(
            screenHeight - screenY - screenH,
            constraints.bottom.unit,
            screenHeight,
          ),
        }
      }

      onConstraintChange(newConstraints)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    isDragging,
    dragStart,
    position,
    currentSize,
    constraints,
    onConstraintChange,
    toConstraintValue,
    canvasRef,
    scale,
    screenWidth,
    screenHeight,
  ])

  // Handle resizing - update constraints and/or size based on handle and enabled constraints
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x
      const deltaY = e.clientY - resizeStart.y

      let newWidth = resizeStart.width
      let newHeight = resizeStart.height
      let newPosX = resizeStart.posX
      let newPosY = resizeStart.posY

      // Edge handles - single axis
      if (isResizing === 'n') {
        newHeight = Math.max(30, resizeStart.height - deltaY)
        newPosY = resizeStart.posY + deltaY
      } else if (isResizing === 's') {
        newHeight = Math.max(30, resizeStart.height + deltaY)
      } else if (isResizing === 'e') {
        newWidth = Math.max(50, resizeStart.width + deltaX)
      } else if (isResizing === 'w') {
        newWidth = Math.max(50, resizeStart.width - deltaX)
        newPosX = resizeStart.posX + deltaX
      }
      // Corner handles - both axes
      else if (isResizing === 'se') {
        newWidth = Math.max(50, resizeStart.width + deltaX)
        newHeight = Math.max(30, resizeStart.height + deltaY)
      } else if (isResizing === 'sw') {
        newWidth = Math.max(50, resizeStart.width - deltaX)
        newHeight = Math.max(30, resizeStart.height + deltaY)
        newPosX = resizeStart.posX + deltaX
      } else if (isResizing === 'ne') {
        newWidth = Math.max(50, resizeStart.width + deltaX)
        newHeight = Math.max(30, resizeStart.height - deltaY)
        newPosY = resizeStart.posY + deltaY
      } else if (isResizing === 'nw') {
        newWidth = Math.max(50, resizeStart.width - deltaX)
        newHeight = Math.max(30, resizeStart.height - deltaY)
        newPosX = resizeStart.posX + deltaX
        newPosY = resizeStart.posY + deltaY
      }

      setCurrentSize({ width: newWidth, height: newHeight })
      setPosition({ x: newPosX, y: newPosY })
    }

    const handleMouseUp = () => {
      setIsResizing(null)

      // Convert canvas values to screen values
      const screenX = position.x / scale
      const screenY = position.y / scale
      const screenW = currentSize.width / scale
      const screenH = currentSize.height / scale

      const newConstraints = { ...constraints }
      const isHorizontalStretch =
        constraints.left.enabled && constraints.right.enabled
      const isVerticalStretch =
        constraints.top.enabled && constraints.bottom.enabled

      // Update constraints based on resize direction
      if (isResizing === 'w' || isResizing === 'nw' || isResizing === 'sw') {
        if (constraints.left.enabled) {
          newConstraints.left = {
            ...constraints.left,
            value: toConstraintValue(
              screenX,
              constraints.left.unit,
              screenWidth,
            ),
          }
        }
      }
      if (isResizing === 'e' || isResizing === 'ne' || isResizing === 'se') {
        if (constraints.right.enabled) {
          newConstraints.right = {
            ...constraints.right,
            value: toConstraintValue(
              screenWidth - screenX - screenW,
              constraints.right.unit,
              screenWidth,
            ),
          }
        }
      }
      if (isResizing === 'n' || isResizing === 'nw' || isResizing === 'ne') {
        if (constraints.top.enabled) {
          newConstraints.top = {
            ...constraints.top,
            value: toConstraintValue(
              screenY,
              constraints.top.unit,
              screenHeight,
            ),
          }
        }
      }
      if (isResizing === 's' || isResizing === 'sw' || isResizing === 'se') {
        if (constraints.bottom.enabled) {
          newConstraints.bottom = {
            ...constraints.bottom,
            value: toConstraintValue(
              screenHeight - screenY - screenH,
              constraints.bottom.unit,
              screenHeight,
            ),
          }
        }
      }

      onConstraintChange(newConstraints)

      // Update size if not in stretch mode for that axis
      const newSize = { ...size }
      if (!isHorizontalStretch) {
        newSize.width = toConstraintValue(screenW, size.widthUnit, screenWidth)
      }
      if (!isVerticalStretch) {
        newSize.height = toConstraintValue(
          screenH,
          size.heightUnit,
          screenHeight,
        )
      }
      onSizeChange(newSize)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    isResizing,
    resizeStart,
    currentSize,
    position,
    constraints,
    size,
    onConstraintChange,
    onSizeChange,
    toConstraintValue,
    scale,
    screenWidth,
    screenHeight,
  ])

  return (
    <div
      ref={elementRef}
      className={`absolute cursor-move ${isDragging || isResizing ? 'z-50' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width: currentSize.width,
        height: currentSize.height,
        border: isSelected
          ? '2px solid #6366f1'
          : '1px dashed rgba(255,255,255,0.3)',
        boxSizing: 'border-box',
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      {isSelected && (
        <>
          {/* Corner resize handles */}
          <div
            className="absolute -right-1 -bottom-1 w-3 h-3 bg-indigo-500 cursor-se-resize rounded-sm"
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
          />
          <div
            className="absolute -left-1 -bottom-1 w-3 h-3 bg-indigo-500 cursor-sw-resize rounded-sm"
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
          />
          <div
            className="absolute -right-1 -top-1 w-3 h-3 bg-indigo-500 cursor-ne-resize rounded-sm"
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
          />
          <div
            className="absolute -left-1 -top-1 w-3 h-3 bg-indigo-500 cursor-nw-resize rounded-sm"
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
          />
          {/* Edge resize handles */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-1 w-6 h-2 bg-indigo-500 cursor-n-resize rounded-sm"
            onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-6 h-2 bg-indigo-500 cursor-s-resize rounded-sm"
            onMouseDown={(e) => handleResizeMouseDown(e, 's')}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-6 bg-indigo-500 cursor-w-resize rounded-sm"
            onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-6 bg-indigo-500 cursor-e-resize rounded-sm"
            onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
          />
        </>
      )}
    </div>
  )
}

export function ScreenEditorCanvas({
  screen,
  contentType,
  selectedElement,
  zoom,
  onSelectElement,
  onUpdateElement,
}: ScreenEditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [displaySize, setDisplaySize] = useState({ width: 800, height: 450 })

  const config = screen.contentConfigs[contentType]
  const sample = SAMPLE_CONTENT[contentType]
  const canvasWidth = screen.width
  const canvasHeight = screen.height

  // Calculate display size to fit container while maintaining aspect ratio
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return
      const container = containerRef.current
      const maxWidth = container.clientWidth - 40
      const maxHeight = container.clientHeight - 40
      const aspectRatio = canvasWidth / canvasHeight

      let width = maxWidth
      let height = width / aspectRatio

      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }

      setDisplaySize({ width: width * zoom, height: height * zoom })
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [canvasWidth, canvasHeight, zoom])

  const scale = displaySize.width / canvasWidth

  const handleBackgroundClick = () => {
    onSelectElement(null)
  }

  const handleConstraintChange = useCallback(
    (elementType: string) => (newConstraints: Constraints) => {
      onUpdateElement(elementType, { constraints: newConstraints })
    },
    [onUpdateElement],
  )

  const handleSizeChange = useCallback(
    (elementType: string) => (newSize: SizeWithUnits) => {
      onUpdateElement(elementType, { size: newSize })
    },
    [onUpdateElement],
  )

  // Render elements based on content type
  const elements = useMemo(() => {
    const els: React.ReactElement[] = []

    // Main text / Content text
    if ('mainText' in config) {
      const mt = config.mainText
      const bounds = calculatePixelBounds(
        mt.constraints,
        mt.size,
        canvasWidth,
        canvasHeight,
      )

      els.push(
        <DraggableElement
          key="mainText"
          x={bounds.x * scale}
          y={bounds.y * scale}
          width={bounds.width * scale}
          height={bounds.height * scale}
          constraints={mt.constraints}
          size={mt.size}
          isSelected={selectedElement?.type === 'mainText'}
          onClick={() => onSelectElement({ type: 'mainText' })}
          onConstraintChange={handleConstraintChange('mainText')}
          onSizeChange={handleSizeChange('mainText')}
          canvasWidth={displaySize.width}
          canvasHeight={displaySize.height}
          screenWidth={canvasWidth}
          screenHeight={canvasHeight}
          canvasRef={canvasRef}
        >
          <TextContent
            content={sample?.main ?? 'Main Content'}
            style={{ ...mt.style, maxFontSize: mt.style.maxFontSize * scale }}
            containerWidth={bounds.width * scale}
            containerHeight={bounds.height * scale}
            padding={mt.padding * scale}
            isHtml={true}
          />
        </DraggableElement>,
      )
    }

    if ('contentText' in config) {
      const ct = config.contentText
      const bounds = calculatePixelBounds(
        ct.constraints,
        ct.size,
        canvasWidth,
        canvasHeight,
      )

      els.push(
        <DraggableElement
          key="contentText"
          x={bounds.x * scale}
          y={bounds.y * scale}
          width={bounds.width * scale}
          height={bounds.height * scale}
          constraints={ct.constraints}
          size={ct.size}
          isSelected={selectedElement?.type === 'contentText'}
          onClick={() => onSelectElement({ type: 'contentText' })}
          onConstraintChange={handleConstraintChange('contentText')}
          onSizeChange={handleSizeChange('contentText')}
          canvasWidth={displaySize.width}
          canvasHeight={displaySize.height}
          screenWidth={canvasWidth}
          screenHeight={canvasHeight}
          canvasRef={canvasRef}
        >
          <TextContent
            content={sample?.main ?? 'Content Text'}
            style={{ ...ct.style, maxFontSize: ct.style.maxFontSize * scale }}
            containerWidth={bounds.width * scale}
            containerHeight={bounds.height * scale}
          />
        </DraggableElement>,
      )
    }

    // Reference text (bible, versete_tineri)
    if ('referenceText' in config) {
      const rt = config.referenceText
      const bounds = calculatePixelBounds(
        rt.constraints,
        rt.size,
        canvasWidth,
        canvasHeight,
      )

      els.push(
        <DraggableElement
          key="referenceText"
          x={bounds.x * scale}
          y={bounds.y * scale}
          width={bounds.width * scale}
          height={bounds.height * scale}
          constraints={rt.constraints}
          size={rt.size}
          isSelected={selectedElement?.type === 'referenceText'}
          onClick={() => onSelectElement({ type: 'referenceText' })}
          onConstraintChange={handleConstraintChange('referenceText')}
          onSizeChange={handleSizeChange('referenceText')}
          canvasWidth={displaySize.width}
          canvasHeight={displaySize.height}
          screenWidth={canvasWidth}
          screenHeight={canvasHeight}
          canvasRef={canvasRef}
        >
          <TextContent
            content={sample?.reference ?? 'Reference'}
            style={{ ...rt.style, maxFontSize: rt.style.maxFontSize * scale }}
            containerWidth={bounds.width * scale}
            containerHeight={bounds.height * scale}
          />
        </DraggableElement>,
      )
    }

    // Person label (versete_tineri)
    if ('personLabel' in config) {
      const pl = config.personLabel
      const bounds = calculatePixelBounds(
        pl.constraints,
        pl.size,
        canvasWidth,
        canvasHeight,
      )

      els.push(
        <DraggableElement
          key="personLabel"
          x={bounds.x * scale}
          y={bounds.y * scale}
          width={bounds.width * scale}
          height={bounds.height * scale}
          constraints={pl.constraints}
          size={pl.size}
          isSelected={selectedElement?.type === 'personLabel'}
          onClick={() => onSelectElement({ type: 'personLabel' })}
          onConstraintChange={handleConstraintChange('personLabel')}
          onSizeChange={handleSizeChange('personLabel')}
          canvasWidth={displaySize.width}
          canvasHeight={displaySize.height}
          screenWidth={canvasWidth}
          screenHeight={canvasHeight}
          canvasRef={canvasRef}
        >
          <TextContent
            content={sample?.person ?? 'Person Name'}
            style={{ ...pl.style, maxFontSize: pl.style.maxFontSize * scale }}
            containerWidth={bounds.width * scale}
            containerHeight={bounds.height * scale}
          />
        </DraggableElement>,
      )
    }

    // Clock
    const clockConfig =
      'clock' in config ? config.clock : screen.globalSettings.clockConfig
    if (clockConfig?.enabled) {
      // Default size for backwards compatibility with configs that don't have size
      const clockSize = clockConfig.size ?? {
        width: 10,
        widthUnit: '%' as const,
        height: 5,
        heightUnit: '%' as const,
      }
      const bounds = calculatePixelBounds(
        clockConfig.constraints,
        clockSize,
        canvasWidth,
        canvasHeight,
      )

      els.push(
        <DraggableElement
          key="clock"
          x={bounds.x * scale}
          y={bounds.y * scale}
          width={bounds.width * scale}
          height={bounds.height * scale}
          constraints={clockConfig.constraints}
          size={clockSize}
          isSelected={selectedElement?.type === 'clock'}
          onClick={() => onSelectElement({ type: 'clock' })}
          onConstraintChange={handleConstraintChange('clock')}
          onSizeChange={handleSizeChange('clock')}
          canvasWidth={displaySize.width}
          canvasHeight={displaySize.height}
          screenWidth={canvasWidth}
          screenHeight={canvasHeight}
          canvasRef={canvasRef}
        >
          <TextContent
            content={clockConfig.showSeconds ? '12:34:56' : '12:34'}
            style={{
              ...clockConfig.style,
              maxFontSize: clockConfig.style.maxFontSize * scale,
            }}
            containerWidth={bounds.width * scale}
            containerHeight={bounds.height * scale}
          />
        </DraggableElement>,
      )
    }

    // Next slide section (stage screens)
    if (screen.type === 'stage' && screen.nextSlideConfig?.enabled) {
      const ns = screen.nextSlideConfig
      const bounds = calculatePixelBounds(
        ns.constraints,
        ns.size,
        canvasWidth,
        canvasHeight,
      )

      els.push(
        <DraggableElement
          key="nextSlide"
          x={bounds.x * scale}
          y={bounds.y * scale}
          width={bounds.width * scale}
          height={bounds.height * scale}
          constraints={ns.constraints}
          size={ns.size}
          isSelected={selectedElement?.type === 'nextSlide'}
          onClick={() => onSelectElement({ type: 'nextSlide' })}
          onConstraintChange={handleConstraintChange('nextSlide')}
          onSizeChange={handleSizeChange('nextSlide')}
          canvasWidth={displaySize.width}
          canvasHeight={displaySize.height}
          screenWidth={canvasWidth}
          screenHeight={canvasHeight}
          canvasRef={canvasRef}
        >
          <div
            className="w-full h-full p-4"
            style={getBackgroundCSS(ns.background)}
          >
            <div
              style={{
                ...getTextStyleCSS(ns.labelStyle),
                fontSize: ns.labelStyle.maxFontSize * scale,
              }}
            >
              {ns.labelText}
            </div>
            <div
              className="mt-2"
              style={{
                ...getTextStyleCSS(ns.contentStyle),
                fontSize: ns.contentStyle.maxFontSize * scale,
              }}
            >
              Next slide content preview...
            </div>
          </div>
        </DraggableElement>,
      )
    }

    return els
  }, [
    screen,
    config,
    sample,
    selectedElement,
    onSelectElement,
    displaySize,
    scale,
    canvasWidth,
    canvasHeight,
    handleConstraintChange,
    handleSizeChange,
  ])

  // Background style
  const bg =
    'background' in config
      ? config.background
      : screen.globalSettings.defaultBackground

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 overflow-auto p-4"
      onClick={handleBackgroundClick}
    >
      <div
        ref={canvasRef}
        className="relative rounded-lg overflow-hidden shadow-2xl border border-gray-300 dark:border-gray-600"
        style={{
          width: displaySize.width,
          height: displaySize.height,
          ...getBackgroundCSS(bg),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {elements}
      </div>
    </div>
  )
}

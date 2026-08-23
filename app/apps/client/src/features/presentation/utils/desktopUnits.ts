import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { getCurrentPlatform } from './platform'

/**
 * Where a window sits on the desktop, in the one unit that means the same thing
 * on every display.
 *
 * That unit differs by OS. Windows lays its displays out in physical pixels.
 * macOS lays them out in logical points and scales each display on its own, so
 * a physical position there is only meaningful on the display it was measured
 * on: asking a Retina window to move to the projector's physical origin lands
 * it halfway across the laptop screen instead. Everything that crosses from one
 * display to another goes through here, so the unit is decided in one place.
 */
export interface DesktopPoint {
  x: number
  y: number
}

export interface DesktopSize {
  width: number
  height: number
}

/** Whether the desktop is laid out in logical points rather than pixels. */
export function desktopIsLogical(): boolean {
  return getCurrentPlatform() === 'macos'
}

/** A window's top-left corner, in desktop units. */
export async function windowDesktopPosition(
  win: WebviewWindow,
): Promise<DesktopPoint> {
  const position = await win.outerPosition()
  if (!desktopIsLogical()) return { x: position.x, y: position.y }
  const logical = position.toLogical(await win.scaleFactor())
  return { x: logical.x, y: logical.y }
}

/** A window's outer size, in desktop units. */
export async function windowDesktopSize(
  win: WebviewWindow,
): Promise<DesktopSize> {
  const size = await win.outerSize()
  if (!desktopIsLogical()) return { width: size.width, height: size.height }
  const logical = size.toLogical(await win.scaleFactor())
  return { width: logical.width, height: logical.height }
}

/** Moves a window's top-left corner to a point given in desktop units. */
export async function setWindowDesktopPosition(
  win: WebviewWindow,
  point: DesktopPoint,
): Promise<void> {
  const { LogicalPosition, PhysicalPosition } = await import(
    '@tauri-apps/api/dpi'
  )
  await win.setPosition(
    desktopIsLogical()
      ? new LogicalPosition(point.x, point.y)
      : new PhysicalPosition(point.x, point.y),
  )
}

/** Resizes a window to a size given in desktop units. */
export async function setWindowDesktopSize(
  win: WebviewWindow,
  size: DesktopSize,
): Promise<void> {
  const { LogicalSize, PhysicalSize } = await import('@tauri-apps/api/dpi')
  await win.setSize(
    desktopIsLogical()
      ? new LogicalSize(size.width, size.height)
      : new PhysicalSize(size.width, size.height),
  )
}

import { desktopIsLogical } from './desktopUnits'

/**
 * A physical display, in the units window placement uses.
 *
 * Geometry is in desktop units — see `desktopUnits.ts` — so a point on one
 * display and a point on another can be compared, and a window can be sent
 * from one to the other. Tauri reports monitors in physical pixels; on macOS,
 * where the desktop is laid out in logical points and each display scales them
 * on its own, that is converted here and nowhere else.
 */
export interface ScreenMonitor {
  /**
   * The key a screen stores. The OS's own name for the monitor when it has one
   * — `Built-in Retina Display`, `\\.\DISPLAY1`, `HDMI-1` — falling back to the
   * monitor's origin, which is stable for as long as the desk is arranged the
   * same way.
   */
  name: string
  /** The name the OS gave it, or null when it has none to give. */
  osName: string | null
  /** Position of the monitor in the desktop's coordinate space. */
  x: number
  y: number
  width: number
  height: number
  /** Physical pixels per logical one on this display. */
  scaleFactor: number
}

/** What Tauri hands back for a monitor, in physical pixels. */
export interface TauriMonitor {
  name: string | null
  position: { x: number; y: number }
  size: { width: number; height: number }
  scaleFactor: number
}

/**
 * Reshapes a Tauri monitor into the flat form the placement code uses.
 *
 * @param logicalDesktop Whether the desktop is laid out in logical points, in
 * which case the physical geometry is divided by the monitor's own scale.
 */
export function toScreenMonitor(
  monitor: TauriMonitor,
  logicalDesktop: boolean = desktopIsLogical(),
): ScreenMonitor {
  const scale = monitor.scaleFactor || 1
  const unit = logicalDesktop ? scale : 1
  return {
    name: monitor.name ?? `@${monitor.position.x},${monitor.position.y}`,
    osName: monitor.name,
    x: Math.round(monitor.position.x / unit),
    y: Math.round(monitor.position.y / unit),
    width: Math.round(monitor.size.width / unit),
    height: Math.round(monitor.size.height / unit),
    scaleFactor: scale,
  }
}

/**
 * The monitor in the units a window's creation options are written in — always
 * logical, whatever the desktop is laid out in. On a logical desktop that is
 * what the monitor already holds.
 */
export function monitorInLogicalUnits(
  monitor: ScreenMonitor,
  logicalDesktop: boolean = desktopIsLogical(),
): { x: number; y: number; width: number; height: number } {
  const unit = logicalDesktop ? 1 : monitor.scaleFactor || 1
  return {
    x: Math.round(monitor.x / unit),
    y: Math.round(monitor.y / unit),
    width: Math.round(monitor.width / unit),
    height: Math.round(monitor.height / unit),
  }
}

/** The monitor's resolution in pixels, for showing to the operator. */
export function monitorPixelSize(
  monitor: ScreenMonitor,
  logicalDesktop: boolean = desktopIsLogical(),
): { width: number; height: number } {
  const unit = logicalDesktop ? monitor.scaleFactor || 1 : 1
  return {
    width: Math.round(monitor.width * unit),
    height: Math.round(monitor.height * unit),
  }
}

/**
 * Every monitor attached right now, in the order the OS lists them. Empty
 * outside the desktop app, where there are no windows to place.
 */
export async function listMonitors(): Promise<ScreenMonitor[]> {
  try {
    const { availableMonitors } = await import('@tauri-apps/api/window')
    return (await availableMonitors()).map((monitor) =>
      toScreenMonitor(monitor),
    )
  } catch {
    // Not in the desktop app, or the platform will not say — either way there
    // is nothing to place a window on.
    return []
  }
}

/**
 * Which display a screen that names none of its own should project on.
 *
 * Anywhere but the display the control room is sitting on: a projection that
 * opens over Church Hub covers the very window the operator is driving it from,
 * and on a two-monitor desk that is never what was meant.
 *
 * When the control room will not say which display it is on, the main one
 * stands in for it — that is where the app comes up — so the projection still
 * goes to the second monitor instead of landing back on top of the operator.
 * Null when there is nothing else to pick, which is its own answer: the
 * projection opens on the one display there is.
 */
export function chooseProjectionMonitor(
  monitors: ScreenMonitor[],
  controlName: string | null,
  primaryName: string | null,
): ScreenMonitor | null {
  if (monitors.length < 2) return null
  const occupied = controlName ?? primaryName
  return monitors.find((monitor) => monitor.name !== occupied) ?? null
}

/** The display {@link chooseProjectionMonitor} picks, read off the desktop. */
export async function getDefaultProjectionMonitor(): Promise<ScreenMonitor | null> {
  const monitors = await listMonitors()
  if (monitors.length < 2) return null

  const controlName = await currentMonitorName()
  const primary = await getPrimaryMonitor()
  return chooseProjectionMonitor(monitors, controlName, primary?.name ?? null)
}

/** The display the window asking for the projection is on, when it will say. */
async function currentMonitorName(): Promise<string | null> {
  try {
    const { currentMonitor } = await import('@tauri-apps/api/window')
    const control = await currentMonitor()
    return control ? toScreenMonitor(control).name : null
  } catch {
    return null
  }
}

/** The monitor the OS treats as the main one, when it names one. */
export async function getPrimaryMonitor(): Promise<ScreenMonitor | null> {
  try {
    const { primaryMonitor } = await import('@tauri-apps/api/window')
    const monitor = await primaryMonitor()
    return monitor ? toScreenMonitor(monitor) : null
  } catch {
    return null
  }
}

/** Whether a point on the desktop falls on this monitor. */
export function monitorContains(
  monitor: ScreenMonitor,
  x: number,
  y: number,
): boolean {
  return (
    x >= monitor.x &&
    x < monitor.x + monitor.width &&
    y >= monitor.y &&
    y < monitor.y + monitor.height
  )
}

/**
 * The monitor a screen is assigned to, or null when it is assigned to none or
 * the one it names is not plugged in — in which case the window opens wherever
 * it lands rather than off the side of the desktop.
 */
export async function findMonitorByName(
  name: string | null | undefined,
): Promise<ScreenMonitor | null> {
  if (!name) return null
  const monitors = await listMonitors()
  return monitors.find((monitor) => monitor.name === name) ?? null
}

/** The monitor holding a point, used to see where a window has been dragged. */
export async function monitorAtPoint(
  x: number,
  y: number,
): Promise<ScreenMonitor | null> {
  const monitors = await listMonitors()
  return monitors.find((monitor) => monitorContains(monitor, x, y)) ?? null
}

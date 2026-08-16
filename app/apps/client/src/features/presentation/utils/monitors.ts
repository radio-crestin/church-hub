/**
 * A physical display, in the units window placement uses.
 *
 * Tauri reports monitor geometry in physical pixels while a window's creation
 * options are logical ones, and on Windows the two differ per monitor. Every
 * placement here is therefore done after creation with `PhysicalPosition` /
 * `PhysicalSize`, so these numbers can be used as they come.
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
}

/** Reshapes a Tauri monitor into the flat form the placement code uses. */
export function toScreenMonitor(monitor: {
  name: string | null
  position: { x: number; y: number }
  size: { width: number; height: number }
}): ScreenMonitor {
  return {
    name: monitor.name ?? `@${monitor.position.x},${monitor.position.y}`,
    osName: monitor.name,
    x: monitor.position.x,
    y: monitor.position.y,
    width: monitor.size.width,
    height: monitor.size.height,
  }
}

/**
 * Every monitor attached right now, in the order the OS lists them. Empty
 * outside the desktop app, where there are no windows to place.
 */
export async function listMonitors(): Promise<ScreenMonitor[]> {
  try {
    const { availableMonitors } = await import('@tauri-apps/api/window')
    return (await availableMonitors()).map(toScreenMonitor)
  } catch {
    // Not in the desktop app, or the platform will not say — either way there
    // is nothing to place a window on.
    return []
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

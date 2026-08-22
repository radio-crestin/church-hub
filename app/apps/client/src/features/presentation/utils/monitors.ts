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
  /** Physical pixels per logical one, needed to talk to creation options. */
  scaleFactor: number
}

/** Reshapes a Tauri monitor into the flat form the placement code uses. */
export function toScreenMonitor(monitor: {
  name: string | null
  position: { x: number; y: number }
  size: { width: number; height: number }
  scaleFactor: number
}): ScreenMonitor {
  return {
    name: monitor.name ?? `@${monitor.position.x},${monitor.position.y}`,
    osName: monitor.name,
    x: monitor.position.x,
    y: monitor.position.y,
    width: monitor.size.width,
    height: monitor.size.height,
    scaleFactor: monitor.scaleFactor || 1,
  }
}

/**
 * The same monitor in the units a window's creation options are written in.
 *
 * Everything after creation is physical, so this exists only for the frame a
 * window is *built* with: handing it physical numbers opens it at twice the
 * size it should be on a Retina display.
 */
export function monitorInLogicalUnits(monitor: ScreenMonitor): {
  x: number
  y: number
  width: number
  height: number
} {
  const scale = monitor.scaleFactor || 1
  return {
    x: Math.round(monitor.x / scale),
    y: Math.round(monitor.y / scale),
    width: Math.round(monitor.width / scale),
    height: Math.round(monitor.height / scale),
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

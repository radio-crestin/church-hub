import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { setWindowDesktopPosition, setWindowDesktopSize } from './desktopUnits'
import {
  listMonitors,
  monitorInLogicalUnits,
  monitorPixelSize,
  type ScreenMonitor,
} from './monitors'
import { getFrontendUrl, isTauri } from './openDisplayWindow'

/**
 * How long a badge stays up once its number shows. The badge counts this
 * itself, from the moment it has drawn: a webview that takes a while to load
 * must not spend the operator's three seconds on a black plate.
 */
export const BADGE_MS = 3000

/**
 * When a badge that never drew is taken down anyway, so a page that failed to
 * load cannot leave a black plate over the projector.
 */
const BADGE_FALLBACK_MS = BADGE_MS + 10000

/** Share of the monitor's width and height the badge covers. */
const BADGE_SHARE = 0.5

/**
 * Label prefix, kept in step with the windows `capabilities/default.json` and
 * `capabilities/remote.json` grant: a badge loads the app from the sidecar, and
 * a window the remote capability leaves out is refused every command.
 */
const BADGE_LABEL = 'monitor-badge-'

/** Makes each badge's label its own, so a new one never waits on an old one's. */
let badgeCount = 0

/**
 * Flashes a plate in the middle of each display with the monitor's number and
 * name, the way the OS display settings do, so the operator can tell which
 * monitor is which before assigning a screen to one.
 *
 * The number is the monitor's place in the list the settings show, and the
 * name and resolution are the ones that list shows, so the plate on the wall
 * and the entry in the dropdown read the same.
 *
 * @param monitorName Only badge this monitor, or every monitor when omitted.
 */
export async function identifyMonitors(monitorName?: string): Promise<void> {
  if (!isTauri()) return

  const monitors = await listMonitors()
  await Promise.all(
    monitors.map((monitor, index) =>
      monitorName && monitor.name !== monitorName
        ? undefined
        : showBadge(monitor, index + 1),
    ),
  )
}

/** The badge's URL: the number in the path, what the picker shows beside it. */
function badgeUrl(monitor: ScreenMonitor, number: number): string {
  const { width, height } = monitorPixelSize(monitor)
  const search = new URLSearchParams({ size: `${width}×${height}` })
  if (monitor.osName) search.set('name', monitor.osName)
  return `${getFrontendUrl()}/monitor-badge/${number}?${search}`
}

/** The badge's frame on its monitor, centred, in desktop units. */
function badgeFrame(monitor: ScreenMonitor) {
  const width = Math.round(monitor.width * BADGE_SHARE)
  const height = Math.round(monitor.height * BADGE_SHARE)
  return {
    x: monitor.x + Math.round((monitor.width - width) / 2),
    y: monitor.y + Math.round((monitor.height - height) / 2),
    width,
    height,
  }
}

async function showBadge(monitor: ScreenMonitor, number: number) {
  const { WebviewWindow, getAllWebviewWindows } = await import(
    '@tauri-apps/api/webviewWindow'
  )
  // A badge still up on this monitor makes way: asking twice in a row shows
  // one plate with a fresh countdown, not two stacked.
  const prefix = `${BADGE_LABEL}${number}-`
  for (const old of await getAllWebviewWindows()) {
    if (old.label.startsWith(prefix)) await old.close()
  }
  const label = `${prefix}${++badgeCount}`

  const frame = badgeFrame(monitor)
  // Creation options are logical pixels, a request the OS may round or move;
  // the frame is set again in desktop units once the window exists, the way
  // projection windows are placed, so mixed DPI cannot shift or shrink it.
  const start = monitorInLogicalUnits({ ...monitor, ...frame })
  const badge = new WebviewWindow(label, {
    url: badgeUrl(monitor, number),
    ...start,
    decorations: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    // Never takes the keyboard: the operator is in the middle of picking a
    // monitor, and a badge stealing focus would close the dropdown.
    focus: false,
    focusable: false,
    shadow: false,
    backgroundColor: '#000000',
    visible: false,
  })

  setTimeout(async () => {
    if (await WebviewWindow.getByLabel(label)) {
      await badge.close().catch(logError(`close ${label}`))
    }
  }, BADGE_FALLBACK_MS)

  try {
    await created(badge)
    await setWindowDesktopSize(badge, frame)
    await setWindowDesktopPosition(badge, frame)
    await badge.show()
  } catch (error) {
    logError(`show ${label}`)(error)
  }
}

/** Resolves once the window exists, or rejects with why it could not be made. */
function created(win: WebviewWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    win.once('tauri://created', () => resolve())
    win.once('tauri://error', (event) => reject(event.payload))
  })
}

function logError(action: string) {
  return (error: unknown) => {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error(`[identifyMonitors] Failed to ${action}:`, error)
  }
}

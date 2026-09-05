import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import {
  setWindowDesktopPosition,
  setWindowDesktopSize,
  windowDesktopPosition,
  windowDesktopSize,
} from './desktopUnits'
import { setWindowFullscreen } from './fullscreen'
import { isAppFrontmost } from './isAppFrontmost'
import {
  findMonitorByName,
  getDefaultProjectionMonitor,
  getPrimaryMonitor,
  monitorAtPoint,
  monitorContains,
  monitorInLogicalUnits,
  type ScreenMonitor,
} from './monitors'
import { reclaimFocusSeries } from './reclaimFocusSeries'
import { upsertScreen } from '../service/screens'
import type { Screen } from '../types'

// Versioned: earlier entries were physical pixels, which on macOS mean
// something different on each display, so they are left behind rather than
// read back as desktop units.
const WINDOW_POSITIONS_KEY = 'display-window-positions-v2'

/**
 * Where a projection window sat while it was not fullscreen, in desktop units.
 * Only the windowed geometry lives here: whether the screen runs fullscreen, and
 * which monitor it belongs on, are the screen's own settings, so they survive a
 * cleared cache and can be changed from the settings page.
 */
interface WindowState {
  x: number
  y: number
  width: number
  height: number
}

/** How long a drag settles before the screen records its new monitor. */
const MONITOR_SAVE_DELAY_MS = 500

/**
 * When the control window asks for the keyboard back after a projection
 * window has come up. The projection takes it when it appears and again when
 * its fullscreen transition ends — on macOS around a second in, sometimes
 * later on a slow display — so the asks are spread past that.
 */
const FOCUS_RECLAIM_DELAYS_MS = [200, 500, 900, 1500, 2500]

/**
 * How long after a projection window is built that its taking the keyboard
 * is treated as the window manager's doing rather than the operator's.
 */
const FOCUS_HANDBACK_WINDOW_MS = 4000

/** How long `closeDisplayWindow` waits for the window to actually go away. */
const CLOSE_POLL_MS = 50
const CLOSE_SETTLE_ATTEMPTS = 40

/**
 * Which build of each display window is the current one. Event listeners are
 * keyed by window label, not by window, so the listeners a closed window left
 * behind keep firing for the next window opened under the same label — and
 * would record where that one was while it was still being placed.
 */
const windowGenerations = new Map<string, number>()

/**
 * Display windows on their way out. A fullscreen window leaves fullscreen
 * before it closes and reports the moves that involves; nothing it says from
 * then on is worth remembering.
 */
const closingWindows = new Set<string>()

// Cached isTauri result to avoid repeated checks and logging
let isTauriCached: boolean | null = null

/**
 * Checks if we're running inside Tauri
 * In Tauri v2, checks for __TAURI_INTERNALS__ or __TAURI__
 * Result is cached after first check to prevent excessive logging and computation
 */
export function isTauri(): boolean {
  if (isTauriCached !== null) {
    return isTauriCached
  }
  const hasTauriInternals = '__TAURI_INTERNALS__' in window
  const hasTauri = '__TAURI__' in window
  isTauriCached = hasTauriInternals || hasTauri
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri detection (logged once)
  console.log(
    '[isTauri] __TAURI_INTERNALS__:',
    hasTauriInternals,
    '__TAURI__:',
    hasTauri,
    '(cached)',
  )
  return isTauriCached
}

/**
 * Gets the frontend base URL for display windows
 * In Tauri mode, window.location.origin returns tauri://localhost
 * so we need to use the actual server URL (localhost:3000)
 */
export function getFrontendUrl(): string {
  // In Tauri mode, use 127.0.0.1 (where sidecar serves the app)
  // Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues on macOS
  if (isTauri()) {
    const port = import.meta.env.VITE_SERVER_PORT ?? 3000
    return `http://127.0.0.1:${port}`
  }
  // In browser mode, use the current origin
  return window.location.origin
}

/**
 * Saves window state to localStorage
 */
function saveWindowState(displayId: number, state: WindowState): void {
  try {
    const states = getStoredStates()
    states[displayId] = state
    localStorage.setItem(WINDOW_POSITIONS_KEY, JSON.stringify(states))
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error('[saveWindowState] Failed to save window state:', error)
  }
}

/**
 * Gets stored window states
 */
function getStoredStates(): Record<number, WindowState> {
  try {
    const stored = localStorage.getItem(WINDOW_POSITIONS_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

/**
 * Gets stored state for a specific display
 */
function getStoredState(displayId: number): WindowState | null {
  const states = getStoredStates()
  return states[displayId] || null
}

/**
 * Puts a projection window where its screen says it belongs.
 *
 * A screen that runs fullscreen has its window laid over the whole display
 * first, so that the fullscreen it is sent into afterwards fills that display
 * and not the one the window manager happened to build it on.
 *
 * Run twice for a windowed screen: once before the window is shown, once
 * after. A window that has not been ordered in yet can have its geometry
 * quietly ignored and come up at the frame it was created with — which is how
 * the projection ended up as a small window on a big display. Applying it
 * again to the visible window costs nothing when the first attempt did take.
 */
async function placeWindow(
  win: WebviewWindow,
  screen: Screen,
  monitor: ScreenMonitor | null,
  stored: WindowState | null,
): Promise<void> {
  if (screen.isFullscreen) {
    // Without an assigned monitor, cover the one the window opened on.
    const target = monitor ?? (await currentMonitorOf(win))
    if (target) {
      await coverMonitor(win, target)
    } else {
      // No monitor would say how big it is. Maximising still fills the display
      // the window is on, which beats leaving the projection at the small frame
      // it was created with.
      await win.maximize()
    }
    // The chrome deliberately stays on. macOS only lets a *titled* window go
    // fullscreen — a borderless one refuses without a word — so taking the
    // decorations off first is what stopped the projection from ever filling
    // the screen. `setWindowFullscreen` removes them only if it has to fall
    // back to covering the display by hand.
    return
  }

  if (monitor) {
    await setWindowDesktopPosition(win, monitor)
  }

  if (stored) {
    // Never larger than the display it is going to: a size remembered from a
    // bigger monitor would push the title bar off the top of this one.
    await setWindowDesktopSize(win, {
      width: monitor ? Math.min(stored.width, monitor.width) : stored.width,
      height: monitor ? Math.min(stored.height, monitor.height) : stored.height,
    })
  }

  if (!monitor) {
    if (stored) {
      await setWindowDesktopPosition(win, stored)
    } else {
      await win.center()
    }
    return
  }

  // Back where the operator left it when that is still on this monitor,
  // centred on the monitor otherwise — a corner position from another display
  // would drop the window half off the edge of this one.
  if (stored && monitorContains(monitor, stored.x, stored.y)) {
    await setWindowDesktopPosition(win, stored)
    return
  }

  const size = await windowDesktopSize(win)
  await setWindowDesktopPosition(win, {
    x: monitor.x + Math.max(0, Math.round((monitor.width - size.width) / 2)),
    y: monitor.y + Math.max(0, Math.round((monitor.height - size.height) / 2)),
  })
}

/**
 * Lays a window over a monitor and checks that it got there.
 *
 * The size goes first: macOS resizes a window about its bottom-left corner, so
 * a window sized after it was positioned would hang off the bottom of the
 * display. The position is then read back, because the frame a window is asked
 * for is not always the frame it gets — on macOS a window can be pulled onto
 * the operator's display instead, and a fullscreen entered from there would
 * cover the control room. One more try is enough in practice; the caller
 * learns whether the window is where it should be.
 */
async function coverMonitor(
  win: WebviewWindow,
  monitor: ScreenMonitor,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await setWindowDesktopSize(win, monitor)
    await setWindowDesktopPosition(win, monitor)
    const position = await windowDesktopPosition(win)
    if (monitorContains(monitor, position.x, position.y)) return true
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window placement
    console.warn(
      `[coverMonitor] Window landed at ${position.x},${position.y}, not on ${monitor.name}; retrying`,
    )
  }
  return false
}

/**
 * The monitor a window is currently standing on. Read from the window's own
 * corner rather than `currentMonitor()`, which answers for whichever window is
 * asking — the control room, not the projection being placed.
 */
async function currentMonitorOf(
  win: WebviewWindow,
): Promise<ScreenMonitor | null> {
  try {
    const position = await windowDesktopPosition(win)
    return (
      (await monitorAtPoint(position.x, position.y)) ??
      (await getPrimaryMonitor())
    )
  } catch {
    return null
  }
}

/**
 * The monitor each screen's window was last seen on, so a drag that ends where
 * it started does not write to the database.
 */
const lastKnownMonitor = new Map<number, string | null>()
const monitorSaveTimers = new Map<number, ReturnType<typeof setTimeout>>()

/**
 * Records the monitor a projection window has been dragged onto, so it comes
 * back to the same one. Dragging the window and picking the display in the
 * screens settings write the same field — whichever the operator does last is
 * where the screen projects.
 */
function rememberMonitor(screen: Screen, x: number, y: number): void {
  clearTimeout(monitorSaveTimers.get(screen.id))
  monitorSaveTimers.set(
    screen.id,
    setTimeout(async () => {
      monitorSaveTimers.delete(screen.id)
      try {
        const monitor = await monitorAtPoint(x, y)
        if (!monitor) return
        if (monitor.name === lastKnownMonitor.get(screen.id)) return
        lastKnownMonitor.set(screen.id, monitor.name)
        await upsertScreen({
          id: screen.id,
          name: screen.name,
          type: screen.type,
          monitorName: monitor.name,
        })
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: Error logging
        console.error('[rememberMonitor] Failed to record monitor:', error)
      }
    }, MONITOR_SAVE_DELAY_MS),
  )
}

/**
 * Opens a screen's projection window.
 *
 * The screen carries everything the window needs — the monitor it belongs on,
 * whether it runs fullscreen, whether it floats above other windows — so the
 * window is built at its final geometry instead of being nudged into place after
 * it is already on screen.
 *
 * Set `focus` to false to open without stealing focus from the control room
 * (used for auto-open on startup and auto-reopen after Escape).
 */
export async function openDisplayWindow(
  screen: Screen,
  openMode: 'native' | 'browser' = 'native',
  focus = true,
): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
  console.log(
    `[openDisplayWindow] Opening display ${screen.id} in ${openMode} mode, isTauri: ${isTauri()}, fullscreen: ${screen.isFullscreen}, monitor: ${screen.monitorName ?? 'auto'}, alwaysOnTop: ${screen.alwaysOnTop}, focus: ${focus}`,
  )
  const displayUrl = `${getFrontendUrl()}/screen/${screen.id}`
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
  console.log(`[openDisplayWindow] URL: ${displayUrl}`)

  if (openMode === 'browser') {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
    console.log('[openDisplayWindow] Opening in browser mode')
    await openInBrowser(displayUrl)
    return
  }

  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
  console.log('[openDisplayWindow] Opening in native mode')
  await openInNativeWindow(screen, displayUrl, focus)
}

/**
 * Opens the display in the system's default browser
 */
export async function openInBrowser(url: string): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
  console.log(`[openInBrowser] called, isTauri: ${isTauri()}`)
  if (isTauri()) {
    try {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[openInBrowser] Importing @tauri-apps/plugin-shell')
      const { open } = await import('@tauri-apps/plugin-shell')
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[openInBrowser] Calling shell.open()')
      await open(url)
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[openInBrowser] shell.open() completed')
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.error(
        '[openInBrowser] Failed to open in browser via Tauri:',
        error,
      )
      window.open(url, '_blank')
    }
  } else {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log('[openInBrowser] Opening via window.open')
    window.open(url, '_blank')
  }
}

/**
 * Opens the display in a native Tauri window.
 *
 * The window is created hidden and only shown once it sits on the monitor the
 * screen belongs to, at the size it is meant to have. Building it visible and
 * then moving it is what the operator saw as the projection opening in a small
 * window, maximising and only then going fullscreen — three transitions in front
 * of the congregation, on whichever monitor the OS happened to pick.
 */
async function openInNativeWindow(
  screen: Screen,
  url: string,
  focus = true,
): Promise<void> {
  const displayId = screen.id
  const alwaysOnTop = screen.alwaysOnTop
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
  console.log(`[openInNativeWindow] called, isTauri: ${isTauri()}`)

  if (isTauri()) {
    try {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log(
        '[openInNativeWindow] Importing @tauri-apps/api/webviewWindow',
      )
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] WebviewWindow imported:', WebviewWindow)

      const windowLabel = `display-${displayId}`
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log(`[openInNativeWindow] Window label: ${windowLabel}`)
      const generation = (windowGenerations.get(windowLabel) ?? 0) + 1

      // Check if window already exists
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] Checking for existing window')
      const existingWindow = await WebviewWindow.getByLabel(windowLabel)
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] existingWindow:', existingWindow)
      if (existingWindow) {
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
        console.log(`[openInNativeWindow] Window exists, focus=${focus}`)
        if (focus) {
          await existingWindow.setFocus()
        }
        await existingWindow.setAlwaysOnTop(alwaysOnTop)
        return
      }

      // Where it sat last time it was windowed, and the monitor it belongs on.
      const storedState = getStoredState(displayId)
      // A screen that names a display gets that display. One that names none
      // goes to a display the control room is not on, so the projection never
      // opens over Church Hub itself.
      const monitor =
        (await findMonitorByName(screen.monitorName)) ??
        (await getDefaultProjectionMonitor())
      // Seeded with the display the window is about to open on, not with the
      // one the screen names. Opening a screen that names no display would
      // otherwise look like a drag onto the display we just chose for it, and
      // the screen would be pinned there — after which moving the control room
      // to that monitor would leave the projection sitting on top of it. It
      // stays unassigned until the operator drags it somewhere themselves.
      lastKnownMonitor.set(displayId, monitor?.name ?? screen.monitorName)
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log(
        '[openInNativeWindow] Stored state:',
        storedState,
        'monitor:',
        monitor,
      )

      // The window is built at the monitor's own geometry — in logical pixels,
      // the units creation options are written in — but hidden and windowed,
      // whatever the screen wants. The frame a window is created with is only
      // a request: macOS moves a new window onto the operator's display often
      // enough that a projection built fullscreen in place came up covering the
      // control room, and then recorded that display as its own. Geometry set
      // on a window that already exists does stick, so the window is placed
      // over its display below, sent fullscreen from there, and shown only
      // once it is where it belongs.
      const logicalMonitor = monitor ? monitorInLogicalUnits(monitor) : null

      const windowOptions = {
        url,
        title: screen.name || `Display ${displayId}`,
        // A plain starting frame, never the remembered one: creation options are
        // logical pixels while the geometry we remember is physical, and on a
        // Retina display feeding one to the other opens the window at twice or
        // half the size it should be. `placeWindow` sets the real size below, in
        // the units it was measured in.
        width: logicalMonitor?.width ?? 1280,
        height: logicalMonitor?.height ?? 720,
        // Where the window is asked to be born; `placeWindow` makes sure of it.
        ...(logicalMonitor ? { x: logicalMonitor.x, y: logicalMonitor.y } : {}),
        fullscreen: false,
        resizable: true,
        maximizable: true,
        minimizable: true,
        // Always built with its chrome, even for a screen that goes straight to
        // fullscreen. A window created borderless on macOS has no close /
        // minimise / zoom buttons to give back, so one that later leaves
        // fullscreen ends up with an empty title bar — and, worse, macOS will
        // not put a borderless window into fullscreen at all. The window
        // manager hides the chrome itself for as long as the window fills the
        // screen.
        decorations: true,
        alwaysOnTop,
        skipTaskbar: true,
        focus,
        backgroundColor: '#000000',
        // Placed, sized and — for a fullscreen screen — sent fullscreen while
        // still hidden, so the audience never sees it move.
        visible: false,
      }
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log(
        '[openInNativeWindow] Creating window with options:',
        windowOptions,
      )

      // When focus=false, save the currently focused window so we can restore
      // focus after the new window is created (macOS / some WMs auto-focus
      // new windows regardless of the `focus: false` option).
      const mainWindowToRefocus = focus
        ? null
        : await (async () => {
            try {
              const { getCurrentWindow } = await import(
                '@tauri-apps/api/window'
              )
              return getCurrentWindow()
            } catch {
              return null
            }
          })()

      // Whether Church Hub owned the keyboard at the moment the window was
      // asked for. A screen can reopen on its own (a remote, a footswitch,
      // another client changing the presentation), and when that happens with
      // the operator working in another application, none of the focus
      // restoration below may run — it would drag Church Hub back over them.
      const wasFrontmostBeforeOpen = mainWindowToRefocus
        ? await isAppFrontmost()
        : false

      // Create new native window
      windowGenerations.set(windowLabel, generation)
      const webview = new WebviewWindow(windowLabel, windowOptions)
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log(
        '[openInNativeWindow] WebviewWindow constructor called, webview:',
        webview,
      )

      // Set up event listeners
      webview.once('tauri://created', async () => {
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
        console.log(
          `[openInNativeWindow] Native window created: ${windowLabel}`,
        )

        // Small delay to ensure window is fully ready
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Get the window by label to ensure we have the correct reference
        const win = await WebviewWindow.getByLabel(windowLabel)
        if (!win) {
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
          console.error('[openInNativeWindow] Could not get window by label')
          return
        }

        try {
          await placeWindow(win, screen, monitor, storedState)
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
          console.error('[openInNativeWindow] Failed to place window:', error)
        }

        // A fullscreen screen goes fullscreen from where it was just placed,
        // while still hidden: fullscreen fills the display the window's frame
        // is on, and that frame is now the right one. Entering fullscreen
        // brings the window up by itself.
        if (screen.isFullscreen) {
          try {
            await setWindowFullscreen(win, true)
          } catch (error) {
            // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
            console.error(
              '[openInNativeWindow] Failed to enter fullscreen:',
              error,
            )
          }
        }

        // Shown whatever happened above: a projection stuck invisible is worse
        // than one in the wrong place, so nothing between here and `show()` is
        // allowed to throw past it. A window that fullscreen already brought
        // up is left alone — showing it again would make it the key window
        // and take the keyboard from the control room.
        try {
          if (!(await win.isVisible())) {
            await win.show()
          }
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
          console.error('[openInNativeWindow] Failed to show window:', error)
        }

        // Again for a windowed screen, now that the window is really on
        // screen: geometry set on a window that has not been ordered in yet
        // can be dropped on the floor, and the projection then comes up at
        // the frame it was created with — a small window on a large display.
        if (!screen.isFullscreen) {
          try {
            await placeWindow(win, screen, monitor, storedState)
          } catch (error) {
            // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
            console.error('[openInNativeWindow] Failed to place window:', error)
          }
        }

        // Re-asserted last: changing the decorations rebuilds the window's style
        // on macOS, which drops it back to the ordinary level, and a projection
        // that no longer floats disappears behind the control room.
        try {
          await win.setAlwaysOnTop(alwaysOnTop)
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
          console.error(
            '[openInNativeWindow] Failed to re-assert always on top:',
            error,
          )
        }

        if (focus) {
          await win.setFocus()
        }

        // Remember where the operator leaves the window. Only the windowed
        // geometry is cached; the monitor goes back to the screen itself, so
        // dragging the projection to another display is the same act as picking
        // that display in the settings. Neither is read off a fullscreen or
        // maximised window: those cannot be dragged, and the moves they report
        // while the window manager is still settling them would otherwise
        // overwrite the display the operator chose with whichever one the
        // window passed through.
        const trackState = async () => {
          if (windowGenerations.get(windowLabel) !== generation) return
          if (closingWindows.has(windowLabel)) return
          try {
            const win = await WebviewWindow.getByLabel(windowLabel)
            if (!win) return
            if ((await win.isFullscreen()) || (await win.isMaximized())) return
            const position = await windowDesktopPosition(win)
            const size = await windowDesktopSize(win)
            saveWindowState(displayId, { ...position, ...size })
            rememberMonitor(screen, position.x, position.y)
          } catch {
            // Window might be closed
          }
        }

        // Track state on move, resize, and other changes, for as long as this
        // window is up.
        const unlisten = await Promise.all([
          webview.listen('tauri://move', trackState),
          webview.listen('tauri://resize', trackState),
        ])
        webview.once('tauri://destroyed', () => {
          for (const stop of unlisten) stop()
        })

        // Keep keyboard focus on the control window so the operator can keep
        // navigating verses (keyboard / presenter remote) while the screen
        // shows — the projector window must not steal focus.
        //
        // BUT only when the screen has its own monitor. setFocus() also RAISES
        // the control window; on a single monitor that would cover the
        // projection and the song would seem to "not display". With one
        // monitor we leave the screen in front (visible) instead. With a
        // second monitor the projection is on the other screen, so refocusing
        // the control window is harmless and keyboard input keeps working.
        if (mainWindowToRefocus && wasFrontmostBeforeOpen) {
          const isMultiMonitor = await (async () => {
            try {
              const { availableMonitors } = await import(
                '@tauri-apps/api/window'
              )
              return (await availableMonitors()).length > 1
            } catch {
              return false
            }
          })()

          if (isMultiMonitor) {
            const reclaimFocus = async () => {
              try {
                await mainWindowToRefocus.setFocus()
                // The window being key is not the whole story: the keys go to
                // whatever is first responder inside it, and asking the page
                // for focus is what makes sure that is the page.
                window.focus()
              } catch (error) {
                // biome-ignore lint/suspicious/noConsole: Tauri focus restoration
                console.warn(
                  '[openInNativeWindow] Failed to restore focus to main window:',
                  error,
                )
              }
            }
            // The OS can hand focus back to the new window again once it
            // finishes appearing / the fullscreen transition animates
            // (≈1s on macOS), so re-assert a few more times across that
            // window — but only while Church Hub is still frontmost, so
            // switching to another app in those seconds ends the series.
            const cancelReclaim = reclaimFocusSeries(
              reclaimFocus,
              FOCUS_RECLAIM_DELAYS_MS,
            )
            // And whenever the new window does take the keyboard while it is
            // still settling in — the end of the fullscreen transition lands
            // after every timer above — hand it straight back. The operator
            // is not clicking the projection in its first seconds; they are
            // at the keyboard, about to go to the next slide.
            const settledAt = Date.now() + FOCUS_HANDBACK_WINDOW_MS
            const stopHandback = await webview.listen('tauri://focus', () => {
              if (Date.now() > settledAt) {
                stopHandback()
                return
              }
              reclaimFocusSeries(reclaimFocus, [])
            })
            setTimeout(() => {
              cancelReclaim()
              stopHandback()
            }, FOCUS_HANDBACK_WINDOW_MS)
          }
        }
      })

      webview.once('tauri://error', (e) => {
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
        console.error('[openInNativeWindow] tauri://error event:', e)
      })

      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] Event listeners attached')
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.error('[openInNativeWindow] Error opening native window:', error)
      // Fallback to browser
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] Falling back to browser window.open')
      window.open(url, '_blank')
    }
  } else {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
    console.log('[openInNativeWindow] Not in Tauri, falling back to browser')
    window.open(url, '_blank')
  }
}

/** Whether a screen's native display window is currently up. */
export async function isDisplayWindowOpen(displayId: number): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    return (await WebviewWindow.getByLabel(`display-${displayId}`)) !== null
  } catch {
    return false
  }
}

/**
 * Closes a native display window
 */
export async function closeDisplayWindow(displayId: number): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
  console.log(
    `[closeDisplayWindow] Closing display ${displayId}, isTauri: ${isTauri()}`,
  )
  if (!isTauri()) return

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `display-${displayId}`
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log(`[closeDisplayWindow] Looking for window: ${windowLabel}`)
    const win = await WebviewWindow.getByLabel(windowLabel)
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log(`[closeDisplayWindow] Window found: ${!!win}`)
    if (win) {
      closingWindows.add(windowLabel)
      try {
        await win.close()
        // `close()` returns once the request is in, not once the window is
        // gone. A reopen that follows straight away would still find the old
        // window under its label and keep it instead of building the new one.
        for (let attempt = 0; attempt < CLOSE_SETTLE_ATTEMPTS; attempt++) {
          if (!(await WebviewWindow.getByLabel(windowLabel))) break
          await new Promise((resolve) => setTimeout(resolve, CLOSE_POLL_MS))
        }
      } finally {
        closingWindows.delete(windowLabel)
      }
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[closeDisplayWindow] Window closed successfully')
    } else {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.warn(`[closeDisplayWindow] Window not found: ${windowLabel}`)
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error('[closeDisplayWindow] Failed to close display window:', error)
  }
}

/**
 * Toggles fullscreen mode for a native display window
 */
export async function toggleDisplayFullscreen(
  displayId: number,
): Promise<void> {
  if (!isTauri()) return

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `display-${displayId}`
    const win = await WebviewWindow.getByLabel(windowLabel)
    if (win) {
      const isFullscreen = await win.isFullscreen()
      await win.setFullscreen(!isFullscreen)
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error(
      '[toggleDisplayFullscreen] Failed to toggle fullscreen:',
      error,
    )
  }
}

/**
 * Sets fullscreen mode for a native display window.
 *
 * Goes through `setWindowFullscreen` rather than the raw Tauri call so the
 * window comes out of fullscreen the way the toolbar's own toggle leaves it:
 * chrome back on, macOS simple fullscreen cleared, and small enough to grab.
 */
export async function setDisplayFullscreen(
  displayId: number,
  fullscreen: boolean,
): Promise<void> {
  if (!isTauri()) return

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `display-${displayId}`
    const win = await WebviewWindow.getByLabel(windowLabel)
    if (win) {
      await setWindowFullscreen(win, fullscreen)
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error('[setDisplayFullscreen] Failed to set fullscreen:', error)
  }
}

/**
 * Sets always-on-top mode for a native display window
 */
export async function setDisplayAlwaysOnTop(
  displayId: number,
  alwaysOnTop: boolean,
): Promise<void> {
  if (!isTauri()) return

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `display-${displayId}`
    const win = await WebviewWindow.getByLabel(windowLabel)
    if (win) {
      await win.setAlwaysOnTop(alwaysOnTop)
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error('[setDisplayAlwaysOnTop] Failed to set always on top:', error)
  }
}

/**
 * Opens the screens the operator wants up as soon as the app launches.
 *
 * `isActive` alone used to decide this, which meant the startup set was
 * whatever happened to be open last. `openOnStartup` makes it an explicit,
 * per-screen choice: turn it off and the window stays closed at launch, yet
 * `reopenMissingActiveScreens` still brings it up the moment something is
 * presented — after which it behaves like every other screen.
 */
export async function openAllActiveScreens(screens: Screen[]): Promise<void> {
  const activeScreens = screens.filter((s) => s.isActive && s.openOnStartup)

  for (const screen of activeScreens) {
    // Always use 'native' mode (matching ScreenManager behavior).
    // focus: false keeps the control room focused during startup.
    await openDisplayWindow(screen, 'native', false)
    // Small delay to prevent overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/**
 * Reopens active screen windows that the user manually closed (e.g. clicked X).
 * `screen.isActive` stays true on manual close, so when presentation state
 * changes we re-check and respawn any missing windows.
 */
export async function reopenMissingActiveScreens(
  screens: Screen[],
): Promise<number> {
  if (!isTauri()) return 0

  let reopened = 0
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const activeScreens = screens.filter((s) => s.isActive)

    for (const screen of activeScreens) {
      const windowLabel = `display-${screen.id}`
      const existing = await WebviewWindow.getByLabel(windowLabel)
      if (existing) continue

      // focus: false so the user keeps interacting with the control room
      // while a closed display window auto-reopens behind the scenes.
      await openDisplayWindow(screen, 'native', false)
      reopened += 1
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error(
      '[reopenMissingActiveScreens] Failed to reopen screen window(s):',
      error,
    )
  }
  return reopened
}

/**
 * Brings keyboard focus back to the control (main) window after presenting, so
 * the operator can keep advancing slides/verses from the keyboard without
 * clicking back into the app. macOS / some WMs hand focus to the projector
 * window when it appears or its content changes; this re-claims it.
 *
 * MULTI-MONITOR ONLY — on a single screen, raising the control window would
 * cover the projection (it shares the monitor with it), so we leave focus on
 * the projector there. On a second monitor the projection is elsewhere, so
 * refocusing control is invisible to the audience and keeps the keyboard live.
 * (Mirrors the same guard in `openInNativeWindow`.) A few re-asserts win the
 * focus race against a window that finishes appearing slightly later.
 *
 * FRONTMOST ONLY — each re-assert checks that Church Hub still owns the
 * keyboard, so an operator who switches to another application is never
 * dragged back (`reclaimFocusSeries`).
 */
export async function reclaimControlWindowFocus(): Promise<void> {
  if (!isTauri()) return
  try {
    const { getCurrentWindow, availableMonitors } = await import(
      '@tauri-apps/api/window'
    )
    if ((await availableMonitors()).length <= 1) return

    const control = getCurrentWindow()
    const reclaim = async () => {
      try {
        await control.setFocus()
        window.focus()
      } catch {
        // best-effort; the window may be mid-transition
      }
    }
    reclaimFocusSeries(reclaim, FOCUS_RECLAIM_DELAYS_MS)
  } catch {
    // best-effort focus restoration; never throw into the presentation flow
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Screen } from '../../types'
import { openDisplayWindow } from '../openDisplayWindow'

/**
 * The control window keeping the keyboard while a projection window comes up.
 *
 * The shell is faked: windows are objects that record their listeners, so a
 * test can play the part of the OS — build the window, let it take the
 * keyboard, finish placing it — and watch what the control window asks for.
 * Every window reports `isFocused() === false`, which is what Linux always
 * answers and what Windows answers while WebView2 holds the keyboard.
 */

type Handler = (event: unknown) => void

const tauri = vi.hoisted(() => {
  class FakeWebviewWindow {
    static windows = new Map<string, FakeWebviewWindow>()
    static getByLabel = async (label: string) =>
      FakeWebviewWindow.windows.get(label) ?? null

    readonly label: string
    private readonly handlers = new Map<string, Set<Handler>>()

    constructor(label: string) {
      this.label = label
      FakeWebviewWindow.windows.set(label, this)
    }

    private on(event: string, handler: Handler): () => void {
      const set = this.handlers.get(event) ?? new Set<Handler>()
      set.add(handler)
      this.handlers.set(event, set)
      return () => set.delete(handler)
    }

    once(event: string, handler: Handler) {
      const stop = this.on(event, (payload) => {
        stop()
        handler(payload)
      })
      return Promise.resolve(stop)
    }

    listen(event: string, handler: Handler) {
      return Promise.resolve(this.on(event, handler))
    }

    /** What the OS does: raise one of the window's events. */
    emit(event: string): void {
      for (const handler of [...(this.handlers.get(event) ?? [])]) {
        handler({})
      }
    }

    listenerCount(event: string): number {
      return this.handlers.get(event)?.size ?? 0
    }

    maximize = async () => {}
    center = async () => {}
    show = async () => {}
    isVisible = async () => true
    isFullscreen = async () => false
    isMaximized = async () => false
    setAlwaysOnTop = async () => {}
    setFocus = async () => {}
    isFocused = async () => false
  }

  return {
    FakeWebviewWindow,
    control: {
      setFocus: vi.fn(),
      isFocused: vi.fn(),
    },
    getAllWebviewWindows: vi.fn(),
    availableMonitors: vi.fn(),
  }
})

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: tauri.FakeWebviewWindow,
  getAllWebviewWindows: tauri.getAllWebviewWindows,
}))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => tauri.control,
  availableMonitors: tauri.availableMonitors,
}))
vi.mock('../monitors', () => ({
  findMonitorByName: async () => null,
  getDefaultProjectionMonitor: async () => null,
  getPrimaryMonitor: async () => null,
  monitorAtPoint: async () => null,
  monitorContains: () => false,
  monitorInLogicalUnits: (monitor: unknown) => monitor,
}))
vi.mock('../desktopUnits', () => ({
  setWindowDesktopPosition: async () => {},
  setWindowDesktopSize: async () => {},
  windowDesktopPosition: async () => ({ x: 0, y: 0 }),
  windowDesktopSize: async () => ({ width: 1280, height: 720 }),
}))
vi.mock('../fullscreen', () => ({ setWindowFullscreen: async () => true }))
vi.mock('../../service/screens', () => ({ upsertScreen: async () => ({}) }))

const screen = {
  id: 7,
  name: 'Projector',
  isFullscreen: true,
  alwaysOnTop: false,
  monitorName: null,
} as unknown as Screen

/** Whether the control window's page holds the keyboard, as the test sets it. */
let pageHasFocus = false

/** Opens the projection the way presenting does, and hands back its window. */
async function openProjection() {
  await openDisplayWindow(screen, 'native', false)
  const win = tauri.FakeWebviewWindow.windows.get(`display-${screen.id}`)
  if (!win) throw new Error('the projection window was not built')
  return win
}

describe('openDisplayWindow keeps the keyboard in the control window', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    tauri.FakeWebviewWindow.windows.clear()
    tauri.control.setFocus.mockReset().mockResolvedValue(undefined)
    tauri.control.isFocused.mockReset().mockResolvedValue(false)
    tauri.getAllWebviewWindows
      .mockReset()
      .mockImplementation(async () => [
        tauri.control,
        ...tauri.FakeWebviewWindow.windows.values(),
      ])
    tauri.availableMonitors.mockReset().mockResolvedValue([{}, {}])
    pageHasFocus = false
    vi.spyOn(document, 'hasFocus').mockImplementation(() => pageHasFocus)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('hands the keyboard back whenever the projection takes it, though no window reports focus', async () => {
    // The operator just clicked Present in the control window.
    pageHasFocus = true
    const projection = await openProjection()

    // The projection takes the keyboard while it is still being placed —
    // going fullscreen activates it — before its creation work is done.
    pageHasFocus = false
    projection.emit('tauri://focus')
    await vi.advanceTimersByTimeAsync(0)
    expect(tauri.control.setFocus).toHaveBeenCalledTimes(1)

    // And again once it has been placed and shown.
    projection.emit('tauri://created')
    await vi.advanceTimersByTimeAsync(500)
    projection.emit('tauri://focus')
    await vi.advanceTimersByTimeAsync(0)
    expect(tauri.control.setFocus).toHaveBeenCalledTimes(2)
  })

  it('leaves the keyboard alone when Church Hub was not in front as the window opened', async () => {
    // A remote reopened the screen while the operator works in another app.
    pageHasFocus = false
    const projection = await openProjection()

    projection.emit('tauri://focus')
    projection.emit('tauri://created')
    await vi.advanceTimersByTimeAsync(500)
    projection.emit('tauri://focus')
    await vi.advanceTimersByTimeAsync(5000)

    expect(tauri.control.setFocus).not.toHaveBeenCalled()
  })

  it('stops handing the keyboard back once the window has had time to settle', async () => {
    pageHasFocus = true
    const projection = await openProjection()
    pageHasFocus = false

    projection.emit('tauri://created')
    await vi.advanceTimersByTimeAsync(500)
    projection.emit('tauri://focus')
    await vi.advanceTimersByTimeAsync(0)
    expect(tauri.control.setFocus).toHaveBeenCalledTimes(1)

    // Seconds later the operator clicks the projection on purpose: it keeps
    // the keyboard, and nothing is left listening.
    await vi.advanceTimersByTimeAsync(4500)
    projection.emit('tauri://focus')
    await vi.advanceTimersByTimeAsync(0)
    expect(tauri.control.setFocus).toHaveBeenCalledTimes(1)
    expect(projection.listenerCount('tauri://focus')).toBe(0)
  })

  it('never takes the keyboard back on a single monitor', async () => {
    // The projection covers the control window there; raising the control
    // window would hide what the congregation is meant to see.
    tauri.availableMonitors.mockResolvedValue([{}])
    pageHasFocus = true
    const projection = await openProjection()
    pageHasFocus = false

    projection.emit('tauri://focus')
    projection.emit('tauri://created')
    await vi.advanceTimersByTimeAsync(500)
    projection.emit('tauri://focus')
    await vi.advanceTimersByTimeAsync(5000)

    expect(tauri.control.setFocus).not.toHaveBeenCalled()
  })
})

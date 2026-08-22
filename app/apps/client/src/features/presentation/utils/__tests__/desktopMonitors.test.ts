import { describe, expect, it } from 'vitest'

import {
  monitorContains,
  monitorInLogicalUnits,
  monitorPixelSize,
  type TauriMonitor,
  toScreenMonitor,
} from '../monitors'

// A laptop's Retina display with a 1080p projector to its right, as Tauri
// reports them: physical pixels, each display scaled on its own.
const retina: TauriMonitor = {
  name: 'Built-in Retina Display',
  position: { x: 0, y: 0 },
  size: { width: 3024, height: 1964 },
  scaleFactor: 2,
}
const projector: TauriMonitor = {
  name: 'HDMI-1',
  position: { x: 1512, y: 0 },
  size: { width: 1920, height: 1080 },
  scaleFactor: 1,
}

describe('toScreenMonitor on a logical desktop (macOS)', () => {
  it('lays the displays out in points so they do not overlap', () => {
    const laptop = toScreenMonitor(retina, true)
    const wall = toScreenMonitor(projector, true)
    expect(laptop).toMatchObject({ x: 0, y: 0, width: 1512, height: 982 })
    expect(wall).toMatchObject({ x: 1512, y: 0, width: 1920, height: 1080 })
    // The projector's origin is on the projector, not on the laptop screen.
    expect(monitorContains(laptop, wall.x, wall.y)).toBe(false)
    expect(monitorContains(wall, wall.x, wall.y)).toBe(true)
  })

  it('hands creation options the same points', () => {
    const wall = toScreenMonitor(projector, true)
    expect(monitorInLogicalUnits(wall, true)).toEqual({
      x: 1512,
      y: 0,
      width: 1920,
      height: 1080,
    })
  })

  it('still knows the resolution in pixels', () => {
    expect(monitorPixelSize(toScreenMonitor(retina, true), true)).toEqual({
      width: 3024,
      height: 1964,
    })
  })
})

describe('toScreenMonitor on a physical desktop (Windows, Linux)', () => {
  const scaled: TauriMonitor = {
    name: '\\\\.\\DISPLAY1',
    position: { x: 0, y: 0 },
    size: { width: 3840, height: 2160 },
    scaleFactor: 1.5,
  }

  it('keeps the pixels Tauri reported', () => {
    expect(toScreenMonitor(scaled, false)).toMatchObject({
      x: 0,
      y: 0,
      width: 3840,
      height: 2160,
      scaleFactor: 1.5,
    })
  })

  it('scales creation options down to logical pixels', () => {
    expect(
      monitorInLogicalUnits(toScreenMonitor(scaled, false), false),
    ).toEqual({ x: 0, y: 0, width: 2560, height: 1440 })
  })

  it('reports the resolution as it is', () => {
    expect(monitorPixelSize(toScreenMonitor(scaled, false), false)).toEqual({
      width: 3840,
      height: 2160,
    })
  })
})

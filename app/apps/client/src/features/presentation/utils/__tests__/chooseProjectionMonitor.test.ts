import { describe, expect, it } from 'vitest'

import { chooseProjectionMonitor, type ScreenMonitor } from '../monitors'

function monitor(name: string, x: number): ScreenMonitor {
  return {
    name,
    osName: name,
    x,
    y: 0,
    width: 1920,
    height: 1080,
    scaleFactor: 1,
  }
}

const control = monitor('Built-in Retina Display', 0)
const projector = monitor('HDMI-1', 1920)

describe('chooseProjectionMonitor', () => {
  it('picks the display the control room is not on', () => {
    expect(
      chooseProjectionMonitor([control, projector], control.name, control.name),
    ).toEqual(projector)
  })

  it('picks the control room display when that is the second one', () => {
    expect(
      chooseProjectionMonitor([projector, control], control.name, control.name),
    ).toEqual(projector)
  })

  it('falls back to the main display when the control room will not say', () => {
    expect(
      chooseProjectionMonitor([control, projector], null, control.name),
    ).toEqual(projector)
  })

  it('has no answer on a single-display desk', () => {
    expect(
      chooseProjectionMonitor([control], control.name, control.name),
    ).toBeNull()
  })

  it('has no answer when every display is the one to avoid', () => {
    expect(
      chooseProjectionMonitor([control, control], control.name, control.name),
    ).toBeNull()
  })
})

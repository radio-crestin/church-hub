import { describe, expect, it } from 'vitest'

import { countFittingActions } from '../countFittingActions'

// Six 26px header buttons 4px apart take 6 * 26 + 5 * 4 = 176px.
const SIX_BUTTONS = [26, 26, 26, 26, 26, 26]

describe('countFittingActions', () => {
  it('keeps every action inline when they all fit', () => {
    expect(
      countFittingActions({
        actionWidths: SIX_BUTTONS,
        moreWidth: 26,
        available: 176,
        gap: 4,
      }),
    ).toBe(6)
  })

  it('ignores a sub-pixel shortfall instead of flipping on rounding', () => {
    expect(
      countFittingActions({
        actionWidths: SIX_BUTTONS,
        moreWidth: 26,
        available: 175.7,
        gap: 4,
      }),
    ).toBe(6)
  })

  it('leaves room for the More trigger once anything overflows', () => {
    // One pixel short of all six: the trigger takes a slot, so two move.
    expect(
      countFittingActions({
        actionWidths: SIX_BUTTONS,
        moreWidth: 26,
        available: 175,
        gap: 4,
      }),
    ).toBe(4)
  })

  it('moves the rightmost actions first, whatever their widths', () => {
    // 40 + 4 + 30 + 4 + 26 (More) = 104 fits; adding the 60px one does not.
    expect(
      countFittingActions({
        actionWidths: [40, 30, 60, 26],
        moreWidth: 26,
        available: 110,
        gap: 4,
      }),
    ).toBe(2)
  })

  it('shows only the More trigger when not even one action fits beside it', () => {
    expect(
      countFittingActions({
        actionWidths: SIX_BUTTONS,
        moreWidth: 26,
        available: 40,
        gap: 4,
      }),
    ).toBe(0)
    expect(
      countFittingActions({
        actionWidths: SIX_BUTTONS,
        moreWidth: 26,
        available: -20,
        gap: 4,
      }),
    ).toBe(0)
  })

  it('has nothing to hide when there are no actions', () => {
    expect(
      countFittingActions({
        actionWidths: [],
        moreWidth: 26,
        available: 0,
        gap: 4,
      }),
    ).toBe(0)
  })
})

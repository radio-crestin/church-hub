import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLiveProgramNavigation } from '../useLiveProgramNavigation'
import {
  type ScheduleFlatNavigation,
  useScheduleFlatNavigation,
} from '../useScheduleFlatNavigation'

vi.mock('~/features/presentation', () => ({
  usePresentationState: vi.fn(),
}))
vi.mock('../useScheduleFlatNavigation', () => ({
  useScheduleFlatNavigation: vi.fn(),
}))

const { usePresentationState } = await import('~/features/presentation')
const presentationState = vi.mocked(usePresentationState)
const flatNavigation = vi.mocked(useScheduleFlatNavigation)

function liveContent(scheduleId?: number) {
  presentationState.mockReturnValue({
    data: {
      temporaryContent: {
        type: 'announcement',
        data: { content: 'Anunt', scheduleId, scheduleItemIndex: 2 },
      },
    },
  } as unknown as ReturnType<typeof usePresentationState>)
}

function navigation(
  overrides: Partial<ScheduleFlatNavigation>,
): ScheduleFlatNavigation {
  return {
    isScheduleLive: true,
    flatItems: [{}, {}, {}],
    ...overrides,
  } as unknown as ScheduleFlatNavigation
}

describe('useLiveProgramNavigation', () => {
  beforeEach(() => {
    flatNavigation.mockReset()
  })

  it('walks the program the projector is showing a step of', () => {
    liveContent(7)
    const nav = navigation({})
    flatNavigation.mockReturnValue(nav)

    const { result } = renderHook(() => useLiveProgramNavigation())

    expect(flatNavigation).toHaveBeenCalledWith({ scheduleId: 7 })
    expect(result.current).toBe(nav)
  })

  it('has nothing to walk when the live content is not from a program', () => {
    liveContent(undefined)
    flatNavigation.mockReturnValue(navigation({ isScheduleLive: false }))

    const { result } = renderHook(() => useLiveProgramNavigation())

    expect(flatNavigation).toHaveBeenCalledWith({ scheduleId: null })
    expect(result.current).toBeNull()
  })

  it('waits for the running order before walking it', () => {
    liveContent(7)
    flatNavigation.mockReturnValue(navigation({ flatItems: [] }))

    const { result } = renderHook(() => useLiveProgramNavigation())

    expect(result.current).toBeNull()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/features/navigation', () => ({ clearLastVisitedState: vi.fn() }))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ warn: vi.fn() }),
}))

const answeredBy = (databaseId?: string) =>
  new Response('{}', {
    headers: databaseId ? { 'X-Church-Hub-Database': databaseId } : {},
  })

describe('trackServerDatabase', () => {
  const assign = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    sessionStorage.clear()
    vi.stubGlobal('location', { pathname: '/songs/42', assign })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    assign.mockReset()
  })

  async function load() {
    return import('../trackServerDatabase')
  }

  it('keeps going while the same database answers', async () => {
    const { trackServerDatabase } = await load()
    expect(trackServerDatabase(answeredBy('aaa'))).toBe(false)
    expect(trackServerDatabase(answeredBy('aaa'))).toBe(false)
    expect(trackServerDatabase(answeredBy())).toBe(false)
    expect(assign).not.toHaveBeenCalled()
  })

  it('reloads on the section list when another database answers', async () => {
    const { trackServerDatabase, takeServerChangedFlag } = await load()
    const { clearLastVisitedState } = await import('~/features/navigation')
    trackServerDatabase(answeredBy('aaa'))

    expect(trackServerDatabase(answeredBy('bbb'))).toBe(true)
    expect(assign).toHaveBeenCalledWith('/songs')
    expect(clearLastVisitedState).toHaveBeenCalled()
    expect(takeServerChangedFlag()).toBe(true)
    expect(takeServerChangedFlag()).toBe(false)
  })
})

describe('sectionListPath', () => {
  it('goes to the list of the current section', async () => {
    const { sectionListPath } = await import('../trackServerDatabase')
    expect(sectionListPath('/songs/42/edit')).toBe('/songs')
    expect(sectionListPath('/schedules/3')).toBe('/schedules')
    expect(sectionListPath('/')).toBe('/')
  })

  it('keeps display windows where they are', async () => {
    const { sectionListPath } = await import('../trackServerDatabase')
    expect(sectionListPath('/screen/2')).toBe('/screen/2')
  })
})

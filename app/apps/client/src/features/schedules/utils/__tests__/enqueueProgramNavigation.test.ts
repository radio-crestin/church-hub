import { describe, expect, it } from 'vitest'

import { enqueueProgramNavigation } from '../enqueueProgramNavigation'

/** A step that finishes only when told to. */
function deferredStep(log: string[], name: string) {
  let finish = () => {}
  const step = () =>
    new Promise<void>((resolve) => {
      log.push(`start ${name}`)
      finish = () => {
        log.push(`end ${name}`)
        resolve()
      }
    })
  return { step, finish: () => finish() }
}

describe('enqueueProgramNavigation', () => {
  it('starts a step only after the one before it has landed', async () => {
    const log: string[] = []
    const first = deferredStep(log, 'first')
    const second = deferredStep(log, 'second')

    const firstDone = enqueueProgramNavigation(first.step)
    const secondDone = enqueueProgramNavigation(second.step)
    await Promise.resolve()
    await Promise.resolve()
    expect(log).toEqual(['start first'])

    first.finish()
    await firstDone
    await Promise.resolve()
    expect(log).toEqual(['start first', 'end first', 'start second'])

    second.finish()
    await secondDone
    expect(log).toEqual([
      'start first',
      'end first',
      'start second',
      'end second',
    ])
  })

  it('hands a failure to its caller and still runs the next step', async () => {
    const failing = enqueueProgramNavigation(() =>
      Promise.reject(new Error('offline')),
    )
    let ran = false
    const next = enqueueProgramNavigation(async () => {
      ran = true
    })

    await expect(failing).rejects.toThrow('offline')
    await next
    expect(ran).toBe(true)
  })
})

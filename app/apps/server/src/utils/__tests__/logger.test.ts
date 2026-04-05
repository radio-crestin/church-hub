// biome-ignore-all lint/suspicious/noConsole: Testing logger requires direct console access
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

// We need to test createLogger with different env variable states.
// Since the module reads env vars at import time, we use mock.module
// to control the shouldLog behavior.

describe('createLogger', () => {
  let originalDebug: string | undefined
  let originalVerbose: string | undefined

  beforeEach(() => {
    originalDebug = process.env.DEBUG
    originalVerbose = process.env.VERBOSE
  })

  afterEach(() => {
    // Restore original env
    if (originalDebug !== undefined) {
      process.env.DEBUG = originalDebug
    } else {
      delete process.env.DEBUG
    }
    if (originalVerbose !== undefined) {
      process.env.VERBOSE = originalVerbose
    } else {
      delete process.env.VERBOSE
    }
  })

  it('formats messages with namespace and level', async () => {
    // Dynamically import to test formatting logic
    const { createLogger } = await import('../../utils/logger')
    const logger = createLogger('test-ns')

    // Capture console output
    const logs: string[] = []
    const origInfo = console.info
    console.info = (...args: any[]) => logs.push(args.join(' '))

    logger.info('hello world')
    console.info = origInfo

    expect(logs).toHaveLength(1)
    expect(logs[0]).toBe('[test-ns:info] hello world')
  })

  it('info level always logs', async () => {
    process.env.DEBUG = 'false'
    process.env.VERBOSE = 'false'

    const { createLogger } = await import('../../utils/logger')
    const logger = createLogger('svc')

    const logs: string[] = []
    const origInfo = console.info
    console.info = (...args: any[]) => logs.push(args.join(' '))

    logger.info('test message')
    console.info = origInfo

    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('[svc:info]')
  })

  it('warning level always logs', async () => {
    const { createLogger } = await import('../../utils/logger')
    const logger = createLogger('svc')

    const logs: string[] = []
    const origWarn = console.warn
    console.warn = (...args: any[]) => logs.push(args.join(' '))

    logger.warning('warn message')
    console.warn = origWarn

    expect(logs).toHaveLength(1)
    expect(logs[0]).toBe('[svc:warning] warn message')
  })

  it('error level always logs', async () => {
    const { createLogger } = await import('../../utils/logger')
    const logger = createLogger('svc')

    const logs: string[] = []
    const origError = console.error
    console.error = (...args: any[]) => logs.push(args.join(' '))

    logger.error('error message')
    console.error = origError

    expect(logs).toHaveLength(1)
    expect(logs[0]).toBe('[svc:error] error message')
  })

  it('creates logger with correct namespace', async () => {
    const { createLogger } = await import('../../utils/logger')
    const logger = createLogger('my-service')

    const logs: string[] = []
    const origInfo = console.info
    console.info = (...args: any[]) => logs.push(args.join(' '))

    logger.info('test')
    console.info = origInfo

    expect(logs[0]).toStartWith('[my-service:info]')
  })

  it('logger has all expected methods', async () => {
    const { createLogger } = await import('../../utils/logger')
    const logger = createLogger('test')

    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.verbose).toBe('function')
    expect(typeof logger.trace).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warning).toBe('function')
    expect(typeof logger.error).toBe('function')
  })
})

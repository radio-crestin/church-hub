// biome-ignore-all lint/suspicious/noConsole: Testing logger requires direct console access
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createLogger } from '../logger'

describe('createLogger', () => {
  const originalEnv = import.meta.env.VITE_DEBUG

  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    import.meta.env.VITE_DEBUG = originalEnv
    vi.restoreAllMocks()
  })

  it('returns an object with debug, info, warn, and error methods', () => {
    const logger = createLogger('test')
    expect(logger).toHaveProperty('debug')
    expect(logger).toHaveProperty('info')
    expect(logger).toHaveProperty('warn')
    expect(logger).toHaveProperty('error')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
  })

  describe('error level', () => {
    it('always logs errors regardless of VITE_DEBUG', () => {
      import.meta.env.VITE_DEBUG = ''
      const logger = createLogger('app:test')
      logger.error('something broke', { detail: 42 })
      expect(console.error).toHaveBeenCalledWith('[app:test] something broke', {
        detail: 42,
      })
    })

    it('logs errors even when VITE_DEBUG is undefined', () => {
      import.meta.env.VITE_DEBUG = undefined as unknown as string
      const logger = createLogger('app:test')
      logger.error('fail')
      expect(console.error).toHaveBeenCalledWith('[app:test] fail')
    })
  })

  describe('warn level', () => {
    it('always logs warnings regardless of VITE_DEBUG', () => {
      import.meta.env.VITE_DEBUG = ''
      const logger = createLogger('app:test')
      logger.warn('heads up')
      expect(console.warn).toHaveBeenCalledWith('[app:test] heads up')
    })
  })

  describe('debug level', () => {
    it('does not log when VITE_DEBUG is empty', () => {
      import.meta.env.VITE_DEBUG = ''
      const logger = createLogger('app:test')
      logger.debug('hidden')
      expect(console.debug).not.toHaveBeenCalled()
    })

    it('logs when namespace matches VITE_DEBUG exactly', () => {
      import.meta.env.VITE_DEBUG = 'app:test'
      const logger = createLogger('app:test')
      logger.debug('visible')
      expect(console.debug).toHaveBeenCalledWith('[app:test] visible')
    })

    it('does not log when namespace does not match', () => {
      import.meta.env.VITE_DEBUG = 'app:other'
      const logger = createLogger('app:test')
      logger.debug('hidden')
      expect(console.debug).not.toHaveBeenCalled()
    })

    it('logs with additional arguments', () => {
      import.meta.env.VITE_DEBUG = 'app:test'
      const logger = createLogger('app:test')
      logger.debug('data', 1, 'two', { three: 3 })
      expect(console.debug).toHaveBeenCalledWith('[app:test] data', 1, 'two', {
        three: 3,
      })
    })
  })

  describe('info level', () => {
    it('does not log when VITE_DEBUG is empty', () => {
      import.meta.env.VITE_DEBUG = ''
      const logger = createLogger('app:test')
      logger.info('hidden')
      expect(console.log).not.toHaveBeenCalled()
    })

    it('logs when namespace matches VITE_DEBUG exactly', () => {
      import.meta.env.VITE_DEBUG = 'app:test'
      const logger = createLogger('app:test')
      logger.info('visible')
      expect(console.log).toHaveBeenCalledWith('[app:test] visible')
    })
  })

  describe('wildcard pattern matching', () => {
    it('matches everything with *', () => {
      import.meta.env.VITE_DEBUG = '*'
      const logger = createLogger('anything:goes')
      logger.debug('visible')
      expect(console.debug).toHaveBeenCalledWith('[anything:goes] visible')
    })

    it('matches prefix with :* wildcard', () => {
      import.meta.env.VITE_DEBUG = 'app:*'
      const loggerMatch = createLogger('app:display')
      const loggerNoMatch = createLogger('other:display')

      loggerMatch.debug('yes')
      loggerNoMatch.debug('no')

      expect(console.debug).toHaveBeenCalledTimes(1)
      expect(console.debug).toHaveBeenCalledWith('[app:display] yes')
    })

    it('matches nested namespaces with :* wildcard', () => {
      import.meta.env.VITE_DEBUG = 'app:*'
      const logger = createLogger('app:display:renderer')
      logger.debug('nested')
      expect(console.debug).toHaveBeenCalledWith(
        '[app:display:renderer] nested',
      )
    })
  })

  describe('comma-separated patterns', () => {
    it('matches any of multiple patterns', () => {
      import.meta.env.VITE_DEBUG = 'app:display, app:audio'
      const display = createLogger('app:display')
      const audio = createLogger('app:audio')
      const network = createLogger('app:network')

      display.debug('d')
      audio.debug('a')
      network.debug('n')

      expect(console.debug).toHaveBeenCalledTimes(2)
      expect(console.debug).toHaveBeenCalledWith('[app:display] d')
      expect(console.debug).toHaveBeenCalledWith('[app:audio] a')
    })

    it('handles patterns with mixed exact and wildcard', () => {
      import.meta.env.VITE_DEBUG = 'app:display, lib:*'
      const display = createLogger('app:display')
      const libAnything = createLogger('lib:something')
      const other = createLogger('app:other')

      display.debug('d')
      libAnything.debug('l')
      other.debug('o')

      expect(console.debug).toHaveBeenCalledTimes(2)
    })

    it('trims whitespace around patterns', () => {
      import.meta.env.VITE_DEBUG = '  app:test  ,  app:other  '
      const logger = createLogger('app:test')
      logger.debug('trimmed')
      expect(console.debug).toHaveBeenCalledWith('[app:test] trimmed')
    })
  })

  describe('namespace formatting', () => {
    it('prefixes messages with [namespace]', () => {
      import.meta.env.VITE_DEBUG = '*'
      const logger = createLogger('my:namespace')

      logger.debug('dbg')
      logger.info('inf')
      logger.warn('wrn')
      logger.error('err')

      expect(console.debug).toHaveBeenCalledWith('[my:namespace] dbg')
      expect(console.log).toHaveBeenCalledWith('[my:namespace] inf')
      expect(console.warn).toHaveBeenCalledWith('[my:namespace] wrn')
      expect(console.error).toHaveBeenCalledWith('[my:namespace] err')
    })
  })
})

/**
 * Logger utility with environment variable controlled debug output
 * Use DEBUG env variable to enable logging: DEBUG=app:* or specific patterns
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function isDebugEnabled(namespace: string): boolean {
  if (typeof window === 'undefined') return false
  const debug = import.meta.env.VITE_DEBUG || ''
  if (!debug) return false

  // Support wildcard patterns like 'app:*' or specific namespaces like 'app:display'
  const patterns = debug.split(',').map((p) => p.trim())
  return patterns.some((pattern) => {
    if (pattern === '*') return true
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2)
      return namespace.startsWith(prefix)
    }
    return namespace === pattern
  })
}

function log(
  level: LogLevel,
  namespace: string,
  message: string,
  ...args: unknown[]
): void {
  if (level === 'error') {
    // Always log errors
    // biome-ignore lint/suspicious/noConsole: Logger intentionally uses console
    console.error(`[${namespace}] ${message}`, ...args)
  } else if (level === 'warn') {
    // Always log warnings
    // biome-ignore lint/suspicious/noConsole: Logger intentionally uses console
    console.warn(`[${namespace}] ${message}`, ...args)
  } else if (isDebugEnabled(namespace)) {
    // Only log debug/info if enabled
    if (level === 'debug') {
      // biome-ignore lint/suspicious/noConsole: Logger intentionally uses console
      console.debug(`[${namespace}] ${message}`, ...args)
    } else if (level === 'info') {
      // biome-ignore lint/suspicious/noConsole: Logger intentionally uses console
      console.log(`[${namespace}] ${message}`, ...args)
    }
  }
}

export function createLogger(namespace: string) {
  return {
    debug: (message: string, ...args: unknown[]) =>
      log('debug', namespace, message, ...args),
    info: (message: string, ...args: unknown[]) =>
      log('info', namespace, message, ...args),
    warn: (message: string, ...args: unknown[]) =>
      log('warn', namespace, message, ...args),
    error: (message: string, ...args: unknown[]) =>
      log('error', namespace, message, ...args),
  }
}

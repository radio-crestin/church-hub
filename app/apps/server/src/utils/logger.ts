const DEBUG = process.env.DEBUG === 'true'
const VERBOSE = process.env.VERBOSE === 'true'

type LogLevel = 'debug' | 'verbose' | 'trace' | 'info' | 'warning' | 'error'

function shouldLog(level: LogLevel): boolean {
  switch (level) {
    case 'debug':
      return DEBUG
    case 'verbose':
    case 'trace':
      return VERBOSE || DEBUG
    case 'info':
    case 'warning':
    case 'error':
      return true
    default:
      return true
  }
}

function formatMessage(
  namespace: string,
  level: LogLevel,
  message: string,
): string {
  return `[${namespace}:${level}] ${message}`
}

export function createLogger(namespace: string) {
  return {
    debug: (message: string) => {
      if (shouldLog('debug')) {
        // biome-ignore lint/suspicious/noConsole: Debug logging is intentional
        console.log(formatMessage(namespace, 'debug', message))
      }
    },
    verbose: (message: string) => {
      if (shouldLog('verbose')) {
        // biome-ignore lint/suspicious/noConsole: Verbose logging is intentional
        console.log(formatMessage(namespace, 'verbose', message))
      }
    },
    trace: (message: string) => {
      if (shouldLog('trace')) {
        // biome-ignore lint/suspicious/noConsole: Trace logging is intentional
        console.log(formatMessage(namespace, 'trace', message))
      }
    },
    info: (message: string) => {
      if (shouldLog('info')) {
        // biome-ignore lint/suspicious/noConsole: Info logging is intentional
        console.info(formatMessage(namespace, 'info', message))
      }
    },
    warning: (message: string) => {
      if (shouldLog('warning')) {
        // biome-ignore lint/suspicious/noConsole: Warning logging is intentional
        console.warn(formatMessage(namespace, 'warning', message))
      }
    },
    error: (message: string) => {
      if (shouldLog('error')) {
        // biome-ignore lint/suspicious/noConsole: Error logging is intentional
        console.error(formatMessage(namespace, 'error', message))
      }
    },
  }
}

import { log } from '../../../../utils/fileLogger'

export const inworldLogger = {
  debug: (msg: string, data?: unknown) =>
    log('voice-isolation', 'debug', msg, data),
  info: (msg: string, data?: unknown) =>
    log('voice-isolation', 'info', msg, data),
  warn: (msg: string, data?: unknown) =>
    log('voice-isolation', 'warn', msg, data),
  error: (msg: string, data?: unknown) =>
    log('voice-isolation', 'error', msg, data),
}

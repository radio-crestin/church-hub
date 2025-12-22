import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { getLogsDir } from './paths'

const LOG_DIR = getLogsDir()

// Ensure log directory exists (with error handling for read-only filesystems)
try {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }
} catch {
  // Silently ignore if we can't create log directory (e.g., read-only filesystem)
}

function getTimestamp(): string {
  return new Date().toISOString()
}

function getLogFilePath(prefix: string): string {
  const date = new Date().toISOString().split('T')[0]
  return join(LOG_DIR, `${prefix}-${date}.log`)
}

function formatLogMessage(
  level: string,
  category: string,
  message: string,
  data?: unknown,
): string {
  const timestamp = getTimestamp()
  const dataStr = data ? ` ${JSON.stringify(data)}` : ''
  return `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}${dataStr}\n`
}

export function logToFile(
  category: string,
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  data?: unknown,
): void {
  try {
    const logPath = getLogFilePath('server')
    const formatted = formatLogMessage(level, category, message, data)
    appendFileSync(logPath, formatted)
  } catch {
    // Silently fail if we can't write to log file
  }
}

// Also log to console with the same format
export function log(
  category: string,
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  data?: unknown,
): void {
  const formatted = formatLogMessage(level, category, message, data)
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(formatted.trim())
  logToFile(category, level, message, data)
}

// MIDI-specific logger
export const midiLogger = {
  debug: (message: string, data?: unknown) =>
    log('midi', 'debug', message, data),
  info: (message: string, data?: unknown) => log('midi', 'info', message, data),
  warn: (message: string, data?: unknown) => log('midi', 'warn', message, data),
  error: (message: string, data?: unknown) =>
    log('midi', 'error', message, data),
}

// WebSocket-specific logger
export const wsLogger = {
  debug: (message: string, data?: unknown) =>
    log('websocket', 'debug', message, data),
  info: (message: string, data?: unknown) =>
    log('websocket', 'info', message, data),
  warn: (message: string, data?: unknown) =>
    log('websocket', 'warn', message, data),
  error: (message: string, data?: unknown) =>
    log('websocket', 'error', message, data),
}

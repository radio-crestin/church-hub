import type { ChurchProgramData, ExportedScheduleItem } from '../types'

/**
 * Result of parsing a church program file
 */
export interface ParseResult {
  success: boolean
  data?: ChurchProgramData
  error?: string
}

/**
 * Validates an exported schedule item
 */
function isValidScheduleItem(item: unknown): item is ExportedScheduleItem {
  if (!item || typeof item !== 'object') return false
  const obj = item as Record<string, unknown>

  if (typeof obj.sortOrder !== 'number') return false
  if (!['song', 'slide', 'bible_passage'].includes(obj.itemType as string))
    return false

  return true
}

/**
 * Validates a church program data structure
 */
function isValidChurchProgram(data: unknown): data is ChurchProgramData {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>

  if (obj.type !== 'churchprogram') return false
  if (typeof obj.version !== 'number') return false

  if (!obj.schedule || typeof obj.schedule !== 'object') return false
  const schedule = obj.schedule as Record<string, unknown>
  if (typeof schedule.title !== 'string') return false

  if (!Array.isArray(obj.items)) return false

  return obj.items.every(isValidScheduleItem)
}

/**
 * Parses a church program JSON string
 */
export function parseChurchProgram(jsonString: string): ParseResult {
  try {
    const data = JSON.parse(jsonString)

    if (!isValidChurchProgram(data)) {
      return {
        success: false,
        error: 'Invalid church program format',
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse JSON',
    }
  }
}

import type { ChurchProgramData } from '../../schedule-export/types'
import type { ParseChurchProgramResult } from '../types'

/**
 * Validates the structure of a church program data object
 */
function validateChurchProgram(data: unknown): data is ChurchProgramData {
  if (!data || typeof data !== 'object') return false

  const obj = data as Record<string, unknown>

  if (obj.type !== 'churchprogram') return false
  if (typeof obj.version !== 'number') return false
  if (!obj.schedule || typeof obj.schedule !== 'object') return false

  const schedule = obj.schedule as Record<string, unknown>
  if (typeof schedule.title !== 'string') return false

  if (!Array.isArray(obj.items)) return false

  for (const item of obj.items) {
    if (!item || typeof item !== 'object') return false
    const itemObj = item as Record<string, unknown>

    if (itemObj.itemType !== 'song' && itemObj.itemType !== 'slide') {
      return false
    }

    if (typeof itemObj.sortOrder !== 'number') return false

    if (itemObj.itemType === 'song') {
      if (!itemObj.song || typeof itemObj.song !== 'object') return false
      const song = itemObj.song as Record<string, unknown>
      if (typeof song.title !== 'string') return false
      if (!Array.isArray(song.slides)) return false
    }
  }

  return true
}

/**
 * Parses a church program JSON string
 */
export function parseChurchProgram(content: string): ParseChurchProgramResult {
  try {
    const data = JSON.parse(content)

    if (!validateChurchProgram(data)) {
      return {
        success: false,
        error: 'Invalid church program file format',
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse file',
    }
  }
}

import type { ScheduleWithItems } from '../../schedules/types'
import type { ChurchProgramData, ExportedScheduleItem } from '../types'

/**
 * Generates a ChurchProgram JSON structure from a schedule
 */
export function generateChurchProgramJson(
  schedule: ScheduleWithItems,
): ChurchProgramData {
  const items: ExportedScheduleItem[] = schedule.items.map((item) => {
    if (item.itemType === 'song' && item.song) {
      return {
        itemType: 'song' as const,
        sortOrder: item.sortOrder,
        song: {
          title: item.song.title,
          author: null,
          copyright: null,
          ccli: null,
          key: null,
          tempo: null,
          slides: item.slides.map((slide) => ({
            content: slide.content,
            label: slide.label,
            sortOrder: slide.sortOrder,
          })),
        },
      }
    }

    return {
      itemType: 'slide' as const,
      sortOrder: item.sortOrder,
      slideType: item.slideType ?? undefined,
      slideContent: item.slideContent ?? undefined,
    }
  })

  return {
    version: 1,
    type: 'churchprogram',
    schedule: {
      title: schedule.title,
      description: schedule.description,
    },
    items,
  }
}

/**
 * Serializes a ChurchProgram to a JSON string
 */
export function serializeChurchProgram(data: ChurchProgramData): string {
  return JSON.stringify(data, null, 2)
}

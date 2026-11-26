import { parseGlobalSettings } from './parseGlobalSettings'
import { parseLayouts } from './parseLayouts'
import { parseNextSlide } from './parseNextSlide'
import type { SlideTemplate } from './types'
import type { slideTemplates } from '../../db/schema'

const toSeconds = (value: Date | number) =>
  value instanceof Date ? Math.floor(value.getTime() / 1000) : value

export function toSlideTemplate(
  record: typeof slideTemplates.$inferSelect,
): SlideTemplate {
  return {
    id: record.id,
    name: record.name,
    bundledKey: record.bundledKey,
    scheduleId: record.scheduleId,
    width: record.width,
    height: record.height,
    layouts: parseLayouts(record.layouts),
    globalSettings: parseGlobalSettings(record.globalSettings),
    nextSlide: parseNextSlide(record.nextSlide),
    sortOrder: record.sortOrder,
    createdAt: toSeconds(record.createdAt),
    updatedAt: toSeconds(record.updatedAt),
  }
}

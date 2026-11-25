import type {
  ContentType,
  NextSlideSectionConfig,
  ScreenGlobalSettings,
} from '../presentation/types'

/** One layout per slide kind: background, elements, their styles and transitions. */
export type TemplateLayouts = Record<ContentType, Record<string, unknown>>

/** The design part of a template: everything a display draws a slide with. */
export interface TemplateDesign {
  /** The design canvas in px: positions and font sizes are on it. */
  width: number
  height: number
  layouts: TemplateLayouts
  /** The clock's place and look, and the fallback background. */
  globalSettings: ScreenGlobalSettings
  /** The "next slide" strip. */
  nextSlide: NextSlideSectionConfig
}

export interface SlideTemplate extends TemplateDesign {
  id: number
  name: string
  /** Set on the designs that ship with the app: read-only. */
  bundledKey: string | null
  /** The presentation whose own theme this is; null: shared. */
  scheduleId: number | null
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/** Who draws with a template: deleting it is refused while any does. */
export interface TemplateUsage {
  screens: { id: number; name: string }[]
  sceneScreens: { id: number; name: string; obsSceneName: string }[]
  presentations: { id: number; title: string }[]
}

export interface SaveSlideTemplateInput extends Partial<TemplateDesign> {
  name?: string
}

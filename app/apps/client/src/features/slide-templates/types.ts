import type {
  ContentConfigMap,
  ContentType,
  NextSlideSectionConfig,
  ScreenGlobalSettings,
} from '~/features/presentation/types'

/** One layout per slide kind. */
export type TemplateLayouts = { [K in ContentType]: ContentConfigMap[K] }

/** A slide template (CH-184): how every kind of slide looks. */
export interface SlideTemplate {
  id: number
  name: string
  /** Set on the designs that ship with the app: read-only. */
  bundledKey: string | null
  /** The presentation whose own theme this is; null: a shared theme. */
  scheduleId: number | null
  /** The design canvas in px. */
  width: number
  height: number
  layouts: TemplateLayouts
  globalSettings: ScreenGlobalSettings
  nextSlide: NextSlideSectionConfig
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/** Who draws with a template. */
export interface TemplateUsage {
  screens: { id: number; name: string }[]
  sceneScreens: { id: number; name: string; obsSceneName: string }[]
  presentations: { id: number; title: string }[]
}

export type SlideTemplateWithUsage = SlideTemplate & { usage: TemplateUsage }

export type SaveSlideTemplateInput = Partial<
  Pick<
    SlideTemplate,
    'name' | 'width' | 'height' | 'layouts' | 'globalSettings' | 'nextSlide'
  >
>

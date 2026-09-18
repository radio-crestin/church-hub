import type { GalleryFilter } from './types'

/** The filter tabs, in display order, with their label and test id. */
export const GALLERY_FILTERS: {
  value: GalleryFilter
  labelKey: string
  testId: string
}[] = [
  { value: 'all', labelKey: 'filters.all', testId: 'gallery-filter-all' },
  {
    value: 'image',
    labelKey: 'filters.images',
    testId: 'gallery-filter-images',
  },
  {
    value: 'video',
    labelKey: 'filters.videos',
    testId: 'gallery-filter-videos',
  },
]

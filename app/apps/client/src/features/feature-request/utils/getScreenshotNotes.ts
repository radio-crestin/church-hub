import type { Annotation, ScreenshotNote } from '../types'

/** The text notes among the annotations, in order: note 1, note 2, ... */
export function getScreenshotNotes(
  annotations: Annotation[],
): ScreenshotNote[] {
  return annotations.filter((annotation) => annotation.kind === 'note')
}

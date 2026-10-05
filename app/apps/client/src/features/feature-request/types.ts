/** What the user types; kept while they retake the screenshot. */
export interface RequestFeatureValues {
  /** Optional description of the request. */
  notes: string
  email: string
}

export interface FeatureRequestPayload {
  /** Optional description; may be empty. */
  notes: string
  /** The notes placed on the screenshot, in order (numbered 1, 2, ...). */
  screenshotNotes?: string[]
  email: string
  route: string
  viewport: string
  osVersion: string
  appVersion: string
  screenshot?: string
  supportId?: string
}

export interface FeatureRequestResult {
  success: boolean
  issueUrl?: string
  issueNumber?: number
  /** `rate_limited` when this network sent too many requests (50 a day). */
  code?: string
  error?: string
}

export interface StrokePoint {
  x: number
  y: number
}

export interface Stroke {
  color: string
  width: number
  points: StrokePoint[]
}

/** A text note placed on the screenshot, at canvas pixels (x, y). */
export interface ScreenshotNote {
  x: number
  y: number
  text: string
}

/** Something the user added on the screenshot, in the order they added it. */
export type Annotation =
  | ({ kind: 'stroke' } & Stroke)
  | ({ kind: 'note' } & ScreenshotNote)

/** Which tool the screenshot step is using. */
export type AnnotationTool = 'pen' | 'note'

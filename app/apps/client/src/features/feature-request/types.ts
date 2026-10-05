/** What the user types; kept while they retake the screenshot. */
export interface RequestFeatureValues {
  /** Optional description of the request. */
  notes: string
  /** Optional reply address; empty when not given. */
  email: string
}

export interface FeatureRequestPayload {
  /** Optional description; may be empty. */
  notes: string
  /** The notes placed on the screenshot, in order (numbered 1, 2, ...). */
  screenshotNotes?: string[]
  /** Optional: without it the request cannot get a reply. */
  email?: string
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

/** A free-hand line (pen or highlighter), in canvas pixels. */
export interface Stroke {
  color: string
  width: number
  /** 1 for the pen; lower for the see-through highlighter. */
  opacity: number
  points: StrokePoint[]
}

export type ShapeType = 'rect' | 'ellipse' | 'arrow'

/** A shape dragged from one corner (or the arrow's tail) to the other. */
export interface Shape {
  shape: ShapeType
  color: string
  width: number
  from: StrokePoint
  to: StrokePoint
}

/** A text note placed on the screenshot, at canvas pixels (x, y). */
export interface ScreenshotNote {
  x: number
  y: number
  text: string
  color: string
}

/** Something the user added on the screenshot, in the order they added it. */
export type Annotation =
  | ({ kind: 'stroke' } & Stroke)
  | ({ kind: 'shape' } & Shape)
  | ({ kind: 'note' } & ScreenshotNote)

/** The markup tools of the screenshot step. */
export type AnnotationTool = 'pen' | 'highlighter' | ShapeType | 'note'

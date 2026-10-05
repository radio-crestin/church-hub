/** What the user types; kept while they retake the screenshot. */
export interface RequestFeatureValues {
  notes: string
  email: string
}

export interface FeatureRequestPayload {
  notes: string
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

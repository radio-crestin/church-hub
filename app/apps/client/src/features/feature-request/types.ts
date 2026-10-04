/** The element the user clicked in the picker. */
export interface PickedElement {
  /** Unique CSS selector: `document.querySelector(selector)` finds it again. */
  selector: string
  /** Readable path from <body> with ids, test ids and a few classes. */
  path: string
  /** Short visible name: aria-label, test id or text. */
  label: string
}

export interface FeatureRequestPayload {
  title: string
  notes: string
  email: string
  route: string
  viewport: string
  osVersion: string
  appVersion: string
  element?: PickedElement
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

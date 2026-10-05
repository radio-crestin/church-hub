import type { ParsedImage } from './parseImageDataUrl'

/** The element the user picked in the app, as captured by the client. */
export interface PickedElement {
  /** Unique CSS selector, e.g. `body > div:nth-of-type(1) > button`. */
  selector: string
  /** Human-readable path with ids, test ids and classes. */
  path: string
  /** Short visible label (text, aria-label or test id) of the element. */
  label?: string
}

export interface FeatureRequestInput {
  /** Sent by older apps; otherwise the first line of the notes. */
  title: string
  /** Optional description; empty when the user wrote none. */
  notes: string
  /** Text notes placed on the screenshot, numbered 1, 2, ... in order. */
  screenshotNotes: string[]
  /**
   * Private: goes only to the maintainer's WhatsApp, never to GitHub.
   * Empty when the user gave none.
   */
  email: string
  route: string
  viewport: string
  osVersion: string
  appVersion: string
  element?: PickedElement
  /** Decoded from a `data:image/(jpeg|png|webp);base64,...` URL, max 5 MB. */
  screenshot?: ParsedImage
  /** PostHog id the app's logs are stored under. Private, like the email. */
  supportId?: string
}

export interface CreatedIssue {
  url: string
  number: number
}

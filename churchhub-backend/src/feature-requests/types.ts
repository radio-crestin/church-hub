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
  title: string
  notes: string
  /** Private: goes only to the maintainer's WhatsApp, never to GitHub. */
  email: string
  route: string
  viewport: string
  osVersion: string
  appVersion: string
  element?: PickedElement
  /** `data:image/(jpeg|png|webp);base64,...` */
  screenshot?: string
  /** PostHog id the app's logs are stored under. Private, like the email. */
  supportId?: string
}

export interface CreatedIssue {
  url: string
  number: number
}

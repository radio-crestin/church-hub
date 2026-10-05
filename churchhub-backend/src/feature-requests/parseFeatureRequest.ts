import {
  NOTES_MAX_LENGTH,
  SELECTOR_MAX_LENGTH,
  SHORT_FIELD_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from './constants'
import { deriveIssueTitle } from './deriveIssueTitle'
import { FeatureRequestError } from './FeatureRequestError'
import { isValidEmail } from './isValidEmail'
import { parseImageDataUrl } from './parseImageDataUrl'
import { readScreenshotNotes } from './readScreenshotNotes'
import { readString } from './readString'
import type { FeatureRequestInput, PickedElement } from './types'

/** Validates the JSON body of `POST /feature-requests`. */
export function parseFeatureRequest(body: unknown): FeatureRequestInput {
  if (!body || typeof body !== 'object') {
    throw new FeatureRequestError('Body must be a JSON object')
  }
  const raw = body as Record<string, unknown>

  const optional = { required: false }
  // Optional: without it the request simply cannot get a reply.
  const email = readString(raw.email, 'email', SHORT_FIELD_MAX_LENGTH, optional)
  if (email && !isValidEmail(email)) {
    throw new FeatureRequestError('email is invalid')
  }
  const notes = readString(raw.notes, 'notes', NOTES_MAX_LENGTH, optional)
  const screenshotNotes = readScreenshotNotes(raw.screenshotNotes)
  const screenshot =
    typeof raw.screenshot === 'string'
      ? parseImageDataUrl(raw.screenshot)
      : undefined
  if (!notes && screenshotNotes.length === 0 && !screenshot) {
    throw new FeatureRequestError(
      'Add a description, a note or a screenshot'
    )
  }
  const title = readString(raw.title, 'title', TITLE_MAX_LENGTH, optional)
  return {
    title: deriveIssueTitle(title, notes, screenshotNotes),
    notes,
    screenshotNotes,
    email,
    route: readString(raw.route, 'route', SHORT_FIELD_MAX_LENGTH, optional),
    viewport: readString(
      raw.viewport,
      'viewport',
      SHORT_FIELD_MAX_LENGTH,
      optional
    ),
    osVersion: readString(raw.osVersion, 'osVersion', SHORT_FIELD_MAX_LENGTH),
    appVersion: readString(
      raw.appVersion,
      'appVersion',
      SHORT_FIELD_MAX_LENGTH
    ),
    element: parseElement(raw.element),
    screenshot,
    supportId:
      readString(raw.supportId, 'supportId', SHORT_FIELD_MAX_LENGTH, optional) ||
      undefined,
  }
}

function parseElement(value: unknown): PickedElement | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object') {
    throw new FeatureRequestError('element must be an object')
  }
  const raw = value as Record<string, unknown>
  return {
    selector: readString(raw.selector, 'element.selector', SELECTOR_MAX_LENGTH),
    path: readString(raw.path, 'element.path', SELECTOR_MAX_LENGTH),
    label: readString(raw.label, 'element.label', SHORT_FIELD_MAX_LENGTH, {
      required: false,
    }),
  }
}

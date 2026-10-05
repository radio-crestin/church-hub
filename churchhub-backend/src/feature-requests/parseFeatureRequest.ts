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
import { readString } from './readString'
import type { FeatureRequestInput, PickedElement } from './types'

/** Validates the JSON body of `POST /feature-requests`. */
export function parseFeatureRequest(body: unknown): FeatureRequestInput {
  if (!body || typeof body !== 'object') {
    throw new FeatureRequestError('Body must be a JSON object')
  }
  const raw = body as Record<string, unknown>

  const email = readString(raw.email, 'email', SHORT_FIELD_MAX_LENGTH)
  if (!isValidEmail(email)) throw new FeatureRequestError('email is invalid')

  const optional = { required: false }
  const notes = readString(raw.notes, 'notes', NOTES_MAX_LENGTH)
  const title = readString(raw.title, 'title', TITLE_MAX_LENGTH, optional)
  return {
    title: deriveIssueTitle(title, notes),
    notes,
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
    screenshot:
      typeof raw.screenshot === 'string'
        ? parseImageDataUrl(raw.screenshot)
        : undefined,
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

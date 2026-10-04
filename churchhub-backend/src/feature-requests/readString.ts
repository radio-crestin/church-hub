import { FeatureRequestError } from './FeatureRequestError'

/** Returns the trimmed string field, or throws when it is missing or too long. */
export function readString(
  value: unknown,
  field: string,
  maxLength: number,
  { required = true } = {}
): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) {
    throw new FeatureRequestError(`${field} is required`)
  }
  if (text.length > maxLength) {
    throw new FeatureRequestError(
      `${field} is longer than ${maxLength} characters`
    )
  }
  return text
}

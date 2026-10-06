/**
 * Checks a category coming from a request body before it is saved: a
 * non-empty `name`, an integer `id` and `priority` when given, and an
 * `isHidden` of 0/1 or a boolean when given.
 *
 * @returns a message describing the first problem, or null when valid.
 */
export function validateCategoryInput(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'Invalid category: expected an object'
  }
  const { id, name, priority, isHidden } = body as Record<string, unknown>

  if (typeof name !== 'string' || name.trim() === '') return 'Missing name'
  if (id !== undefined && !Number.isInteger(id)) {
    return 'Invalid category: id must be an integer'
  }
  if (priority !== undefined && !Number.isInteger(priority)) {
    return 'Invalid category: priority must be an integer'
  }
  if (
    isHidden !== undefined &&
    typeof isHidden !== 'boolean' &&
    isHidden !== 0 &&
    isHidden !== 1
  ) {
    return 'Invalid category: isHidden must be 0, 1 or a boolean'
  }
  return null
}

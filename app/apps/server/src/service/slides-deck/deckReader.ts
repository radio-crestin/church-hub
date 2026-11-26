/** Media in the backgrounds gallery: a file name, never a path. */
const MEDIA_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
/** #hex, rgb()/rgba()/hsl(), or a colour name. */
const COLOR =
  /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\([\d\s.,%]+\)|[a-zA-Z]{1,30})$/
/** A font family list, e.g. `'Open Sans', Arial, sans-serif`. */
const FONT_FAMILY = /^[\w\s,'-]{1,200}$/

type Record_ = Record<string, unknown>

/**
 * Reads one object of a deck as the API receives it, refusing whatever does
 * not fit with the path to it (`slides[2].elements[0].x`), so a bad deck is
 * refused whole instead of stored.
 */
export function deckReader(value: unknown, path: string) {
  const fail = (field: string, what: string): never => {
    throw new Error(`Invalid deck: ${path}${field ? `.${field}` : ''} ${what}`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('', 'must be an object')
  }
  const record = value as Record_

  const number = (field: string, min = -1e6, max = 1e6): number => {
    const v = record[field]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      return fail(field, `must be a number from ${min} to ${max}`)
    }
    return v
  }
  const optional = <T>(field: string, read: () => T): T | undefined =>
    record[field] === undefined ? undefined : read()

  return {
    fail,
    value: (field: string) => record[field],
    number,
    optionalNumber: (field: string, min?: number, max?: number) =>
      optional(field, () => number(field, min, max)),
    string: (field: string, maxLength = 200): string => {
      const v = record[field]
      if (typeof v !== 'string' || v.length > maxLength) {
        return fail(field, `must be a text of at most ${maxLength} characters`)
      }
      return v
    },
    id: (field = 'id'): string => {
      const v = record[field]
      if (typeof v !== 'string' || !v || v.length > 100) {
        return fail(field, 'must be a non-empty text id')
      }
      return v
    },
    optionalBoolean: (field: string) =>
      optional(field, () =>
        typeof record[field] === 'boolean'
          ? (record[field] as boolean)
          : fail(field, 'must be true or false'),
      ),
    oneOf: <T extends string>(field: string, values: readonly T[]): T =>
      values.includes(record[field] as T)
        ? (record[field] as T)
        : fail(field, `must be one of ${values.join(', ')}`),
    optionalOneOf: <T extends string>(field: string, values: readonly T[]) =>
      optional(field, () =>
        values.includes(record[field] as T)
          ? (record[field] as T)
          : fail(field, `must be one of ${values.join(', ')}`),
      ),
    mediaId: (field = 'mediaId'): string =>
      typeof record[field] === 'string' &&
      MEDIA_ID.test(record[field] as string)
        ? (record[field] as string)
        : fail(field, 'must be a gallery media id'),
    optionalColor: (field: string) =>
      optional(field, () =>
        typeof record[field] === 'string' && COLOR.test(record[field] as string)
          ? (record[field] as string)
          : fail(field, 'must be a colour'),
      ),
    optionalFontFamily: (field: string) =>
      optional(field, () =>
        typeof record[field] === 'string' &&
        FONT_FAMILY.test(record[field] as string)
          ? (record[field] as string)
          : fail(field, 'must be a font family'),
      ),
    array: (field: string, maxLength = 1000): unknown[] => {
      const v = record[field]
      if (!Array.isArray(v) || v.length > maxLength) {
        return fail(field, `must be a list of at most ${maxLength}`)
      }
      return v
    },
  }
}

export type DeckReader = ReturnType<typeof deckReader>

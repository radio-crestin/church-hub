import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'

/**
 * The Romanian texts were reviewed string by string against where each one
 * is shown (T-043). These checks keep the mistakes that review fixed from
 * coming back: cedilla letters, words written without their diacritics, and
 * placeholders that differ from the English string.
 */

const LOCALES = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/i18n/locales',
)
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

/** Words that are never right without their diacritics. */
const WORDS_MISSING_DIACRITICS = [
  'adauga',
  'afiseaza',
  'actualizari',
  'anuleaza',
  'apasa',
  'cantare',
  'cantarea',
  'cantari',
  'cantarile',
  'cauta',
  'descarca',
  'descarcata',
  'editeaza',
  'inapoi',
  'inchide',
  'instaleaza',
  'salveaza',
  'selecteaza',
  'sterge',
  'urmatorul',
]

type Strings = Map<string, string>

function flatten(node: unknown, prefix = '', out: Strings = new Map()) {
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out.set(path, value)
    else flatten(value, path, out)
  }
  return out
}

function readNamespace(language: string, file: string): Strings {
  return flatten(
    JSON.parse(readFileSync(join(LOCALES, language, file), 'utf8')),
  )
}

function placeholders(text: string) {
  return [...text.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)]
    .map((match) => match[1])
    .sort()
}

const namespaces = readdirSync(join(LOCALES, 'ro')).filter((file) =>
  file.endsWith('.json'),
)

test.describe('Romanian texts', () => {
  test('use the comma-below ș and ț, never the cedilla ş and ţ', () => {
    const cedillas = namespaces.flatMap((file) =>
      [...readNamespace('ro', file)]
        .filter(([, text]) => /[şţŞŢ]/.test(text))
        .map(([key, text]) => `${file}:${key} "${text}"`),
    )
    expect(cedillas).toEqual([])
  })

  test('write every word with its diacritics', () => {
    const pattern = new RegExp(
      `(?<![\\p{L}{])(${WORDS_MISSING_DIACRITICS.join('|')})(?![\\p{L}}])`,
      'iu',
    )
    const misspelled = namespaces.flatMap((file) =>
      [...readNamespace('ro', file)]
        .filter(([, text]) => pattern.test(text))
        .map(([key, text]) => `${file}:${key} "${text}"`),
    )
    expect(misspelled).toEqual([])
  })

  test('keep the placeholders of the English string', () => {
    const mismatched = namespaces.flatMap((file) => {
      const english = readNamespace('en', file)
      const englishByBase = new Map(
        [...english].map(([key, text]) => [
          key.replace(PLURAL_SUFFIX, ''),
          text,
        ]),
      )
      return [...readNamespace('ro', file)].flatMap(([key, text]) => {
        const source =
          english.get(key) ?? englishByBase.get(key.replace(PLURAL_SUFFIX, ''))
        if (source === undefined) return []
        const expected = placeholders(source).filter((name) => name !== 'count')
        const actual = placeholders(text).filter((name) => name !== 'count')
        return JSON.stringify(actual) === JSON.stringify(expected)
          ? []
          : [
              `${file}:${key} ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`,
            ]
      })
    })
    expect(mismatched).toEqual([])
  })

  test('the menus show the reviewed names', async ({ page }) => {
    await setAppLanguage(page, 'ro')
    await page.goto('/settings/backup')
    await expect(page.getByRole('link', { name: /Game cântări/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Actualizări/ })).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Bara laterală/ }),
    ).toBeVisible()
  })
})

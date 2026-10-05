import startupEN from '../../i18n/locales/en/startup.json'
import startupRO from '../../i18n/locales/ro/startup.json'

/**
 * Texts of the start-up loading page. It shows before React (and i18next)
 * load, so it reads the saved language itself and its own namespace file.
 */
export const startupLang: 'en' | 'ro' = (() => {
  try {
    return localStorage.getItem('church-hub-language') === 'ro' ? 'ro' : 'en'
  } catch {
    return 'en'
  }
})()

const texts = startupLang === 'ro' ? startupRO : startupEN

type Texts = typeof startupEN
export type StartupTextKey = Exclude<keyof Texts, 'steps'>
export type StartupStepKey = keyof Texts['steps']

/** A text of the loading page, `{{name}}` replaced by `values.name`. */
export function startupText(
  key: StartupTextKey,
  values: Record<string, string> = {},
): string {
  return texts[key].replace(/\{\{(\w+)\}\}/g, (_, name) => values[name] ?? '')
}

export function startupStepText(step: StartupStepKey): string {
  return texts.steps[step]
}

export function formatCount(count: number): string {
  return count.toLocaleString(startupLang)
}

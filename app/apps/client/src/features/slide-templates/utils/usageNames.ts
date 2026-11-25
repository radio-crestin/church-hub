import type { TemplateUsage } from '../types'

/** Who draws with a template, as one readable list ("Main, Stage · sala"). */
export function usageNames(usage: TemplateUsage): string {
  return [
    ...usage.screens.map((screen) => screen.name),
    ...usage.sceneScreens.map(
      (screen) => `${screen.name} · ${screen.obsSceneName}`,
    ),
    ...usage.presentations.map((presentation) => presentation.title),
  ].join(', ')
}

import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { ScreenSettingsPanel } from '~/features/presentation/components/ScreenSettingsPanel'
import { SettingsLeafGuard } from '~/features/settings'

interface ScreensSearch {
  /** The screen whose settings show. */
  screen?: number
}

export const Route = createFileRoute('/settings/screens')({
  component: ScreenSettings,
  validateSearch: (search: Record<string, unknown>): ScreensSearch => {
    const screen = Number(search.screen)
    return Number.isInteger(screen) && screen > 0 ? { screen } : {}
  },
})

function ScreenSettings() {
  const { screen } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <SettingsLeafGuard itemId="screens">
      <ScreenSettingsPanel
        selectedId={screen}
        onSelect={(id) => navigate({ search: { screen: id }, replace: true })}
      />
    </SettingsLeafGuard>
  )
}

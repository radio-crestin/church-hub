import { createFileRoute } from '@tanstack/react-router'

import { AboutSection } from '~/features/app-update'

export const Route = createFileRoute('/settings/about')({
  component: AboutSettings,
})

function AboutSettings() {
  // AboutSection renders its own card chrome, so it is not wrapped here.
  return <AboutSection />
}

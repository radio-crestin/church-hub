import { createFileRoute } from '@tanstack/react-router'

import { AboutSection } from '~/features/app-update'

export const Route = createFileRoute('/settings/about')({
  component: AboutSettings,
})

function AboutSettings() {
  return <AboutSection />
}

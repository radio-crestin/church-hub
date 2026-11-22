import { createFileRoute } from '@tanstack/react-router'

import { SceneSettingsPage } from '../../../features/livestream'

export const Route = createFileRoute('/livestream/scenes/$sceneId')({
  component: SceneSettingsRoute,
})

function SceneSettingsRoute() {
  const { sceneId } = Route.useParams()
  return <SceneSettingsPage sceneId={Number(sceneId)} />
}

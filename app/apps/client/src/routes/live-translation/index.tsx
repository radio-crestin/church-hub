import { createFileRoute } from '@tanstack/react-router'

import { LiveTranslationPage } from '../../features/live-translation'

export const Route = createFileRoute('/live-translation/')({
  component: LiveTranslationPage,
})

import { createFileRoute } from '@tanstack/react-router'

import { AccountPage } from '~/features/auth'

export const Route = createFileRoute('/account/')({
  component: AccountPage,
})

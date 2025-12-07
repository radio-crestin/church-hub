import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(root)/')({
  beforeLoad: () => {
    throw redirect({ to: '/present' })
  },
})

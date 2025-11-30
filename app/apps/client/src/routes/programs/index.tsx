import { createFileRoute } from '@tanstack/react-router'

import { ProgramList } from '~/features/programs'

export const Route = createFileRoute('/programs/')({
  component: ProgramsPage,
})

function ProgramsPage() {
  return <ProgramList />
}

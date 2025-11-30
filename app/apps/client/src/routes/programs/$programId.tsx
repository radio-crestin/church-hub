import { createFileRoute } from '@tanstack/react-router'

import { ProgramEditor } from '~/features/programs'

export const Route = createFileRoute('/programs/$programId')({
  component: ProgramEditorPage,
})

function ProgramEditorPage() {
  const { programId } = Route.useParams()
  const id = programId === 'new' ? 'new' : parseInt(programId, 10)

  return <ProgramEditor programId={id} />
}

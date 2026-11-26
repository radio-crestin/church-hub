import { libraryRequest } from './libraryRequest'
import type { ServiceSubmission } from './types'

/** The submissions waiting for a curator, as the service keeps them. */
export async function fetchSubmissions(
  ticket: string,
): Promise<ServiceSubmission[]> {
  const { submissions } = await libraryRequest<{
    submissions: ServiceSubmission[]
  }>('GET', '/submissions', { ticket })
  return submissions
}

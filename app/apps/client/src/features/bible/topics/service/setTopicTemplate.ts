import { fetcher } from '~/utils/fetcher'

/** The template a topic draws with; null: its fitting one again. */
export async function setTopicTemplate(
  topicId: number,
  templateId: number | null,
): Promise<void> {
  await fetcher(`/api/bible/topics/${topicId}/template`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId }),
  })
}

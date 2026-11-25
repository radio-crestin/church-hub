import { fetchJsonWithStatus } from '~/utils/fetcher'
import type {
  SaveSlideTemplateInput,
  SlideTemplate,
  SlideTemplateWithUsage,
} from '../types'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const { status, body } = await fetchJsonWithStatus<{
    data?: T
    error?: string
  }>(url, init)
  if (status >= 400 || body.data === undefined) {
    throw new Error(body.error ?? `Slide template request failed (${status})`)
  }
  return body.data
}

export function getSlideTemplates(): Promise<SlideTemplateWithUsage[]> {
  return request('/api/slide-templates')
}

export function getSlideTemplate(id: number): Promise<SlideTemplateWithUsage> {
  return request(`/api/slide-templates/${id}`)
}

/** A new template: a copy of `fromId` when given. */
export function createSlideTemplate(input: {
  name: string
  fromId?: number
}): Promise<SlideTemplate> {
  return request('/api/slide-templates', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
}

export function saveSlideTemplate(
  id: number,
  input: SaveSlideTemplateInput,
): Promise<SlideTemplate> {
  return request(`/api/slide-templates/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
}

export function deleteSlideTemplate(id: number): Promise<{ success: true }> {
  return request(`/api/slide-templates/${id}`, { method: 'DELETE' })
}

/** The template a screen draws with while an OBS scene is live; null: its own. */
export function setSceneTemplate(
  screenId: number,
  obsSceneName: string,
  templateId: number | null,
): Promise<{ success: true }> {
  return request(
    `/api/screens/${screenId}/scene-templates/${encodeURIComponent(obsSceneName)}`,
    {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ templateId }),
    },
  )
}

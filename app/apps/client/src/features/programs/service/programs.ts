import { fetcher } from '~/utils/fetcher'
import type {
  Program,
  ProgramWithSlides,
  Slide,
  UpsertProgramInput,
  UpsertSlideInput,
} from '../types'

interface ApiResponse<T> {
  data: T
}

/**
 * Fetches all programs
 */
export async function getAllPrograms(): Promise<Program[]> {
  const response = await fetcher<ApiResponse<Program[]>>('/api/programs')
  return response.data
}

/**
 * Fetches a program by ID with its slides
 */
export async function getProgramById(
  id: number,
): Promise<ProgramWithSlides | null> {
  try {
    const response = await fetcher<ApiResponse<ProgramWithSlides>>(
      `/api/programs/${id}`,
    )
    return response.data
  } catch {
    return null
  }
}

/**
 * Creates or updates a program
 */
export async function upsertProgram(
  input: UpsertProgramInput,
): Promise<Program> {
  const response = await fetcher<ApiResponse<Program>>('/api/programs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return response.data
}

/**
 * Deletes a program
 */
export async function deleteProgram(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/programs/${id}`,
    { method: 'DELETE' },
  )
  return response.data.success
}

/**
 * Creates or updates a slide
 */
export async function upsertSlide(input: UpsertSlideInput): Promise<Slide> {
  const response = await fetcher<ApiResponse<Slide>>('/api/slides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return response.data
}

/**
 * Deletes a slide
 */
export async function deleteSlide(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/slides/${id}`,
    { method: 'DELETE' },
  )
  return response.data.success
}

/**
 * Reorders slides within a program
 */
export async function reorderSlides(
  programId: number,
  slideIds: number[],
): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/programs/${programId}/slides/reorder`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideIds }),
    },
  )
  return response.data.success
}

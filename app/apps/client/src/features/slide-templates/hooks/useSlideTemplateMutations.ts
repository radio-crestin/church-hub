import { useMutation, useQueryClient } from '@tanstack/react-query'

import { screensQueryKey } from '~/features/presentation/hooks/useScreens'
import { slideTemplatesQueryKey } from './useSlideTemplates'
import {
  createSlideTemplate,
  deleteSlideTemplate,
  saveSlideTemplate,
  setSceneTemplate,
} from '../service/slideTemplates'
import type { SaveSlideTemplateInput } from '../types'

/** Templates and the screens drawing with them load again after a change. */
function useReloadTemplates() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: slideTemplatesQueryKey })
    queryClient.invalidateQueries({ queryKey: screensQueryKey })
  }
}

export function useCreateSlideTemplate() {
  const reload = useReloadTemplates()
  return useMutation({
    mutationFn: createSlideTemplate,
    onSuccess: reload,
  })
}

export function useSaveSlideTemplate() {
  const reload = useReloadTemplates()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number
      input: SaveSlideTemplateInput
    }) => saveSlideTemplate(id, input),
    onSuccess: reload,
  })
}

export function useDeleteSlideTemplate() {
  const reload = useReloadTemplates()
  return useMutation({
    mutationFn: deleteSlideTemplate,
    onSuccess: reload,
  })
}

export function useSetSceneTemplate() {
  const reload = useReloadTemplates()
  return useMutation({
    mutationFn: ({
      screenId,
      obsSceneName,
      templateId,
    }: {
      screenId: number
      obsSceneName: string
      templateId: number | null
    }) => setSceneTemplate(screenId, obsSceneName, templateId),
    onSuccess: reload,
  })
}

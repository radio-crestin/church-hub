import { useQuery } from '@tanstack/react-query'

import { getSlideTemplate, getSlideTemplates } from '../service/slideTemplates'

export const slideTemplatesQueryKey = ['slide-templates'] as const

export function slideTemplateQueryKey(id: number) {
  return [...slideTemplatesQueryKey, id] as const
}

export function useSlideTemplates() {
  return useQuery({
    queryKey: slideTemplatesQueryKey,
    queryFn: getSlideTemplates,
  })
}

/** One template with its usage; nothing is fetched for a null id. */
export function useSlideTemplate(id: number | null | undefined) {
  return useQuery({
    queryKey: slideTemplateQueryKey(id ?? 0),
    queryFn: () => getSlideTemplate(id as number),
    enabled: id != null,
  })
}

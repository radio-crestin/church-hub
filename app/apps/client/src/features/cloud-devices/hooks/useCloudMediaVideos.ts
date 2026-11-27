import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSetting, upsertSetting } from '~/service/settings'

/** The PC's own choice (server: service/cloud-media/cloudMediaVideos.ts). */
const CLOUD_MEDIA_VIDEOS_KEY = 'cloud_media_videos'
const QUERY_KEY = ['settings', CLOUD_MEDIA_VIDEOS_KEY]

/**
 * Whether this PC also puts background videos in the church's cloud for
 * phones (images always go): off by default, since videos are large.
 */
export function useCloudMediaVideos() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () =>
      (await getSetting('app_settings', CLOUD_MEDIA_VIDEOS_KEY))?.value ===
      'true',
  })
  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const saved = await upsertSetting('app_settings', {
        key: CLOUD_MEDIA_VIDEOS_KEY,
        value: String(enabled),
      })
      if (!saved) throw new Error('Could not save the setting')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
  return { enabled: query.data ?? false, set: mutation }
}

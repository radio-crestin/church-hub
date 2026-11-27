import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * The song's old edit page. The editor now opens on the song page itself
 * (`?edit=slides`), so links and bookmarks to this address land there.
 */
export const Route = createFileRoute('/songs/$songId/edit')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/songs/$songId',
      params,
      search: { edit: 'slides' },
      replace: true,
    })
  },
})

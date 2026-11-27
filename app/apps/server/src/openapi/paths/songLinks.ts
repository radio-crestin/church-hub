/** An error answer of the song link routes: the message and its code. */
const error = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { error: { type: 'string' }, code: { type: 'string' } },
      },
    },
  },
})

const json = (description: string, data: Record<string, unknown>) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { data } },
    },
  },
})

const songId = {
  name: 'songId',
  in: 'path',
  required: true,
  schema: { type: 'integer' },
}

const errors = {
  '403': error('No songs.view, or the service refused (forbidden)'),
  '404': error('No such song (song_not_found)'),
  '409': error('Cloud sync is off: a link needs it (cloud_sync_off)'),
  '502': error('The sync service failed'),
}

/** Songs shared by a link (T-177): a public page for each. */
export const songLinkPaths = {
  '/api/song-links/{songId}': {
    post: {
      tags: ['Songs'],
      summary: 'Share a song by link',
      description:
        'Publishes the song as it reads now through the cloud sync service; answers the public page its link opens. The same song keeps the same link; sharing it again updates the page.',
      parameters: [songId],
      responses: {
        '200': json('Shared', {
          type: 'object',
          properties: { url: { type: 'string' } },
        }),
        ...errors,
      },
    },
    delete: {
      tags: ['Songs'],
      summary: 'Stop sharing a song',
      parameters: [songId],
      responses: {
        '200': json('Its link opens nothing now', { type: 'null' }),
        ...errors,
      },
    },
  },
  '/api/song-links/by-uuid/{uuid}': {
    get: {
      tags: ['Songs'],
      summary: 'This device’s copy of a shared song',
      description:
        'The local id of the church’s song with this uuid, which a shared link names.',
      parameters: [
        {
          name: 'uuid',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': json('Found', {
          type: 'object',
          properties: { songId: { type: 'integer' } },
        }),
        '404': error('Not on this device (song_not_found)'),
      },
    },
  },
}

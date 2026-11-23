/**
 * Music — the library's folders and audio files, playlists, and the
 * embedded audio player's status. Playback itself is driven over the
 * WebSocket (`music_*` messages).
 */
const security = [{ bearerAuth: [] }, { cookieAuth: [] }]
const tags = ['Music']

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const dataOf = (schema: object) => ({
  'application/json': {
    schema: { type: 'object', properties: { data: schema } },
  },
})
const arrayOf = (name: string) => ({ type: 'array', items: ref(name) })
const jsonBody = (schema: object) => ({
  required: true,
  content: { 'application/json': { schema } },
})
const success = {
  description: 'Done',
  content: dataOf({
    type: 'object',
    properties: { success: { type: 'boolean', example: true } },
  }),
}
const badRequest = { $ref: '#/components/responses/BadRequest' }
const notFound = { $ref: '#/components/responses/NotFound' }
const unauthorized = { '401': { $ref: '#/components/responses/Unauthorized' } }
const serverError = {
  description: 'Could not be saved',
  content: { 'application/json': { schema: ref('Error') } },
}

const idParameter = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'integer' },
})
const queryParameter = (name: string, type: string, description: string) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema: { type },
})
const folderId = idParameter('id', 'Folder id')
const playlistId = idParameter('id', 'Playlist id')

export const musicPaths = {
  '/api/music/player/status': {
    get: {
      tags,
      summary: 'Get the audio player’s status',
      description:
        'Whether the embedded audio server is running. Playback state comes over the WebSocket.',
      security,
      responses: {
        '200': {
          description: 'Player status',
          content: dataOf(ref('MusicPlayerStatus')),
        },
        ...unauthorized,
      },
    },
  },
  '/api/music/folders': {
    get: {
      tags,
      summary: 'List music folders',
      security,
      responses: {
        '200': {
          description: 'Music folders',
          content: dataOf(arrayOf('MusicFolder')),
        },
        ...unauthorized,
      },
    },
    post: {
      tags,
      summary: 'Add a music folder',
      description:
        'Adds a folder on disk to the library and scans its audio files (mp3, wav, ogg, m4a, flac).',
      security,
      requestBody: jsonBody({
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string', example: '/home/user/Music/Worship' },
          name: {
            type: 'string',
            description: 'Defaults to the folder’s name',
          },
          isRecursive: {
            type: 'boolean',
            description: 'Scan subfolders too',
          },
        },
      }),
      responses: {
        '201': {
          description: 'The added folder',
          content: dataOf(ref('MusicFolder')),
        },
        '400': badRequest,
        ...unauthorized,
        '500': serverError,
      },
    },
  },
  '/api/music/folders/{id}': {
    put: {
      tags,
      summary: 'Rename a music folder',
      security,
      parameters: [folderId],
      requestBody: jsonBody({
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      }),
      responses: {
        '200': {
          description: 'The renamed folder',
          content: dataOf(ref('MusicFolder')),
        },
        '400': badRequest,
        ...unauthorized,
        '404': notFound,
      },
    },
    delete: {
      tags,
      summary: 'Remove a music folder',
      description:
        'Removes the folder and its files from the library; nothing is deleted on disk.',
      security,
      parameters: [folderId],
      responses: { '200': success, ...unauthorized, '404': notFound },
    },
  },
  '/api/music/folders/{id}/sync': {
    post: {
      tags,
      summary: 'Rescan a music folder',
      description:
        'Adds new audio files, updates changed ones and removes those gone from disk.',
      security,
      parameters: [folderId],
      responses: {
        '200': {
          description: 'What the scan changed',
          content: dataOf(ref('SyncResult')),
        },
        ...unauthorized,
        '404': notFound,
      },
    },
  },
  '/api/music/files': {
    get: {
      tags,
      summary: 'List music files',
      description:
        'Sorted by title. With `recent=true`, only the tracks played at least once, last played first.',
      security,
      parameters: [
        queryParameter('folderId', 'integer', 'Only this folder’s files'),
        queryParameter(
          'search',
          'string',
          'Matches title, artist, album or filename',
        ),
        queryParameter('artist', 'string', 'Artist contains this text'),
        queryParameter('album', 'string', 'Album contains this text'),
        queryParameter(
          'recent',
          'boolean',
          'Only played tracks, last played first',
        ),
        queryParameter('limit', 'integer', 'Page size'),
        queryParameter('offset', 'integer', 'Files to skip'),
      ],
      responses: {
        '200': {
          description: 'Music files',
          content: dataOf(arrayOf('MusicFile')),
        },
        ...unauthorized,
      },
    },
  },
  '/api/music/files/{id}': {
    get: {
      tags,
      summary: 'Get a music file',
      security,
      parameters: [idParameter('id', 'File id')],
      responses: {
        '200': {
          description: 'The file',
          content: dataOf(ref('MusicFile')),
        },
        ...unauthorized,
        '404': notFound,
      },
    },
  },
  '/api/music/playlists': {
    get: {
      tags,
      summary: 'List playlists',
      security,
      responses: {
        '200': {
          description: 'Playlists, with their track count and duration',
          content: dataOf(arrayOf('MusicPlaylist')),
        },
        ...unauthorized,
      },
    },
    post: {
      tags,
      summary: 'Create or update a playlist',
      description: 'With an `id`, updates that playlist; without, creates one.',
      security,
      requestBody: jsonBody({
        type: 'object',
        required: ['name'],
        properties: {
          id: { type: 'integer', description: 'Playlist to update' },
          name: { type: 'string', example: 'Sunday prelude' },
          description: { type: ['string', 'null'] },
        },
      }),
      responses: {
        '200': {
          description: 'The updated playlist',
          content: dataOf(ref('MusicPlaylist')),
        },
        '201': {
          description: 'The created playlist',
          content: dataOf(ref('MusicPlaylist')),
        },
        '400': badRequest,
        ...unauthorized,
        '500': serverError,
      },
    },
  },
  '/api/music/playlists/{id}': {
    get: {
      tags,
      summary: 'Get a playlist with its tracks',
      security,
      parameters: [playlistId],
      responses: {
        '200': {
          description: 'The playlist and its items, in order',
          content: dataOf(ref('MusicPlaylistWithItems')),
        },
        ...unauthorized,
        '404': notFound,
      },
    },
    delete: {
      tags,
      summary: 'Delete a playlist',
      description: 'The tracks stay in the library.',
      security,
      parameters: [playlistId],
      responses: { '200': success, ...unauthorized, '404': notFound },
    },
  },
  '/api/music/playlists/{id}/items': {
    post: {
      tags,
      summary: 'Add a track to a playlist',
      description: 'Appended at the end, or right after `afterItemId`.',
      security,
      parameters: [playlistId],
      requestBody: jsonBody({
        type: 'object',
        required: ['fileId'],
        properties: {
          fileId: { type: 'integer' },
          afterItemId: {
            type: 'integer',
            description: 'Playlist item to insert after',
          },
        },
      }),
      responses: {
        '201': success,
        '400': badRequest,
        ...unauthorized,
      },
    },
  },
  '/api/music/playlists/{id}/items/{itemId}': {
    delete: {
      tags,
      summary: 'Remove a track from a playlist',
      security,
      parameters: [playlistId, idParameter('itemId', 'Playlist item id')],
      responses: { '200': success, ...unauthorized, '404': notFound },
    },
  },
  '/api/music/playlists/{id}/items/reorder': {
    put: {
      tags,
      summary: 'Reorder a playlist',
      security,
      parameters: [playlistId],
      requestBody: jsonBody({
        type: 'object',
        required: ['itemIds'],
        properties: {
          itemIds: {
            type: 'array',
            items: { type: 'integer' },
            description: 'All the playlist’s item ids, in the new order',
          },
        },
      }),
      responses: { '200': success, '400': badRequest, ...unauthorized },
    },
  },
}

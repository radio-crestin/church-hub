/**
 * The OpenAPI paths of songs shared by a link (T-177), merged into the
 * service's document (sync/openapi.ts).
 */
const error = (description: string) => ({
  description,
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/Error' } },
  },
})

const word = {
  type: 'object',
  properties: { word: { type: 'string' }, chord: { type: 'string' } },
  required: ['word'],
}

const songFields = {
  title: { type: 'string' },
  author: { type: ['string', 'null'] },
  copyright: { type: ['string', 'null'] },
  keyLine: { type: ['string', 'null'] },
  slides: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        label: { type: ['string', 'null'], description: 'V1, C, Bridge…' },
        lines: { type: 'array', items: { type: 'array', items: word } },
      },
    },
  },
}

const churchPath = [
  { name: 'churchId', in: 'path', required: true, schema: { type: 'string' } },
  {
    name: 'songUuid',
    in: 'path',
    required: true,
    schema: { type: 'string' },
    description: 'The song’s uuid in the church’s synced data',
  },
]

const writeErrors = {
  '400': error('Invalid song (invalid_song) or song id'),
  '401': error('Missing, invalid or revoked token'),
  '403': error('The token’s user lacks songs.view'),
}

export const songLinksOpenApiPaths = {
  '/sync/churches/{churchId}/song-links/{songUuid}': {
    put: {
      summary: 'Share a song by link',
      description:
        'Keeps the song as it reads now for its public page; sharing it again updates the same link. Needs songs.view.',
      security: [{ deviceToken: [] }],
      parameters: churchPath,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: songFields,
              required: ['title', 'slides'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Shared',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { linkId: { type: 'string' } },
              },
            },
          },
        },
        ...writeErrors,
      },
    },
    delete: {
      summary: 'Stop sharing a song',
      security: [{ deviceToken: [] }],
      parameters: churchPath,
      responses: { '204': { description: 'Its link opens nothing now' }, ...writeErrors },
    },
  },
  '/sync/song-links/{linkId}': {
    get: {
      summary: 'A shared song',
      description: 'Public: what the song’s page shows, and the church and song it is.',
      parameters: [
        { name: 'linkId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'The song',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  format: { const: 'church-hub-shared-song' },
                  version: { const: 1 },
                  churchId: { type: 'string' },
                  songUuid: { type: 'string' },
                  sharedAt: { type: 'integer', description: 'Unix ms' },
                  ...songFields,
                },
              },
            },
          },
        },
        '404': error('No song is shared by this link (not_found)'),
      },
    },
  },
}

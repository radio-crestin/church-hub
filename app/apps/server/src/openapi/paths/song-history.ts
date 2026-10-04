/**
 * Song edit history — who saved a change to a song, when, and what it was
 * before and after. Every save that changes the title or slides adds an entry.
 */
const songIdParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'integer' },
}

const entryIdParameter = {
  name: 'entryId',
  in: 'path',
  required: true,
  schema: { type: 'integer' },
}

export const songHistoryPaths = {
  '/api/songs/{id}/history': {
    get: {
      tags: ['Song History'],
      summary: 'List the edit history of a song',
      description:
        'Newest first. Entries carry who saved, when, and a count of what changed; fetch one entry for its full before/after snapshots. Requires `songs.view`.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [songIdParameter],
      responses: {
        '200': {
          description: 'History entries, newest first',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/SongHistoryEntrySummary',
                    },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/songs/{id}/history/{entryId}': {
    get: {
      tags: ['Song History'],
      summary: 'Get one history entry with its before/after snapshots',
      description: 'Requires `songs.view`.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [songIdParameter, entryIdParameter],
      responses: {
        '200': {
          description: 'The history entry',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/SongHistoryEntry' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/songs/{id}/history/{entryId}/restore': {
    post: {
      tags: ['Song History'],
      summary: 'Restore a song to a version from its history',
      description:
        "Puts the song's title and slides back to how they were before or after the given entry. The restore is itself recorded as a new history entry, so it can be undone. Requires `songs.edit`.",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [songIdParameter, entryIdParameter],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['side'],
              properties: {
                side: {
                  type: 'string',
                  enum: ['before', 'after'],
                  description:
                    'Which version of the entry to restore. A created song has no "before".',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The restored song',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Song' },
                },
              },
            },
          },
        },
        '400': { description: 'Missing or invalid `side`' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
}

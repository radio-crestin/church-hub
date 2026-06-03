/**
 * Song Versions (groups) — non-destructive grouping of songs that are
 * different versions of the same underlying piece.
 */
export const songGroupsPaths = {
  '/api/songs/{id}/group': {
    get: {
      tags: ['Song Versions'],
      summary: 'Get the group a song belongs to',
      description:
        'Returns the song group + members for the given song, or null if the song is standalone (its own canonical version).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      responses: {
        '200': {
          description: 'Group or null',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    nullable: true,
                    $ref: '#/components/schemas/SongGroup',
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    delete: {
      tags: ['Song Versions'],
      summary: 'Remove a song from its group ("Not the same song")',
      description:
        'Detaches the song from its group. If the song was the primary, another member is promoted. A group with one remaining member is collapsed into a standalone song.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      responses: {
        '200': {
          description: 'Removed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: { success: { type: 'boolean' } },
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
  '/api/song-groups/{id}': {
    get: {
      tags: ['Song Versions'],
      summary: 'Get a group by id',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      responses: {
        '200': {
          description: 'Group',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/SongGroup' },
                },
              },
            },
          },
        },
        '404': { description: 'Group not found' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/song-groups/link': {
    post: {
      tags: ['Song Versions'],
      summary: 'Mark two songs as versions of the same piece',
      description:
        'High-level link operation: creates a group if neither song has one, otherwise attaches to / merges into the existing group. Idempotent — calling it on two already-grouped songs in the same group is a no-op.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/LinkSongsInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Resulting group',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/SongGroup' },
                },
              },
            },
          },
        },
        '400': { description: 'Invalid input' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/song-groups/{id}/primary': {
    post: {
      tags: ['Song Versions'],
      summary: 'Set the primary member of a group',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SetPrimarySongInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated group',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/SongGroup' },
                },
              },
            },
          },
        },
        '400': { description: 'Invalid input' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
}

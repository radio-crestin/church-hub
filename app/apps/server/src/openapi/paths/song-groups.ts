/**
 * Song Versions (groups) — non-destructive grouping of songs that are
 * different versions of the same underlying piece.
 */
export const songGroupsPaths = {
  '/api/songs/{id}/similar': {
    get: {
      tags: ['Song Versions'],
      summary: 'Suggest songs that look like versions of this one',
      description:
        'On-demand similarity ranking: songs sharing a distinctive title word (60% title + 40% lyrics word overlap), or holding at least 70% of the lyrics words (a re-titled version). Filters out the song itself, its group members and songs in hidden categories. Returns up to `limit` candidates sorted by descending score.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', default: 5, minimum: 1, maximum: 20 },
        },
      ],
      responses: {
        '200': {
          description: 'Suggestions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/SongVersionSuggestion',
                    },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/songs/{id}/same-theme': {
    get: {
      tags: ['Songs'],
      summary: 'Other songs on the same theme as this one',
      description:
        "Ranks the library by how much of this song's distinctive vocabulary each song shares (idf-weighted word stems, words naming a theme such as Christmas or the Cross weighing double), plus a bonus per named theme both are on. Leaves out the song, its versions (its group and what /similar would suggest) and songs in hidden categories.",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', default: 8, minimum: 1, maximum: 20 },
        },
      ],
      responses: {
        '200': {
          description: 'Songs on the same theme, closest first',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/SongThemeSuggestion' },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
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

/**
 * Song sources — the places Song discovery imports songs from. Built-in
 * sources are config files shipped with the app.
 */
export const songSourcesPaths = {
  '/api/song-sources': {
    get: {
      tags: ['Song Sources'],
      summary: 'List song sources',
      description: 'Every song source, built-in first. Requires `songs.view`.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'Song sources',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/SongSource' },
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
}

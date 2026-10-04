export const songBookmarksPaths = {
  '/api/song-bookmarks/export': {
    get: {
      tags: ['Songs'],
      summary: 'Export song bookmarks as Markdown',
      description:
        'Renders the song bookmark list as standard Markdown: each song is a "## Title {#song-12}" heading carrying its song id, then an italic "*Category · key line*" line, then every slide under a "### Label" heading with its lyrics and their **bold**, *italic* and <u>underline</u>. A note is a "> quote".',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'The Markdown document',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'string',
                    example:
                      '## Lauda pe Domnul {#song-12}\n\n*Imnuri*\n\n### Strofa 1\n\nLauda **pe Domnul**, o, suflete\n\n> Final\n',
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
}

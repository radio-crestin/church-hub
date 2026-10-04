export const songBookmarksPaths = {
  '/api/song-bookmarks/text': {
    get: {
      tags: ['Songs'],
      summary: 'Song bookmarks as editable text',
      description:
        'The song bookmark list as the same Markdown the export writes, one line per item and without the lyrics: "## Title {#song-12}" for a song, "> note" for a note.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'The Markdown text',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'string',
                    example:
                      '## Lauda pe Domnul {#song-12}\n> Final\n## Har minunat {#song-40}\n',
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    put: {
      tags: ['Songs'],
      summary: 'Replace song bookmarks from text',
      description:
        'Makes the song bookmark list exactly what the text says, in its order. Reads "## Title {#song-12}" (the id picks the exact song), a bare title or "- title" (matched ignoring case, diacritics and punctuation, then by alternate title), and "> note" or "--- note ---". The lyrics of a full export (lines from a "### slide" heading or the "*Category*" line on) are skipped, so an exported file reads back. All or nothing: if any song line matches no song, nothing changes and those lines are returned. Songs already in the list keep their row and their "sung" mark.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['text'],
              properties: {
                text: { type: 'string', description: 'The Markdown text' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Whether the list was replaced, and any unknown songs',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      applied: {
                        type: 'boolean',
                        description:
                          'False when any line failed: nothing changed',
                      },
                      songs: { type: 'integer' },
                      notes: { type: 'integer' },
                      errors: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            line: { type: 'integer' },
                            content: { type: 'string' },
                            reason: {
                              type: 'string',
                              enum: ['song_not_found'],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/song-bookmarks/export': {
    get: {
      tags: ['Songs'],
      summary: 'Export song bookmarks as Markdown',
      description:
        'Renders the song bookmark list as standard Markdown: each song is a "## Title {#song-12}" heading carrying its song id, then an italic "*Category · key line*" line, then every slide under a "### Label" heading (its number when it has no label) with its lyrics and their **bold**, *italic* and <u>underline</u>. A note is a "> quote".',
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

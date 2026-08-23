const bookmarkListResponse = {
  description: 'The bookmark list, in the user-chosen order',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/BibleBookmark' },
          },
        },
      },
    },
  },
}

const successResponse = {
  description: 'Operation result',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { success: { type: 'boolean' } },
      },
    },
  },
}

export const bibleBookmarksPaths = {
  '/api/bible-bookmarks': {
    get: {
      tags: ['Bible'],
      summary: 'List bookmarked verses',
      description:
        'Returns every bookmarked verse ordered by the position it holds in the list it shares with notes.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': bookmarkListResponse,
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Bible'],
      summary: 'Bookmark a verse',
      description:
        'Appends a verse to the end of the list. The verse is looked up server-side, so only its ID is needed, and any highlighting drawn on it can be saved alongside. The same verse may be bookmarked more than once.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['verseId'],
              properties: {
                verseId: { type: 'integer', description: 'Verse to bookmark' },
                styleRanges: {
                  type: 'array',
                  description:
                    'Highlights and underlines drawn on this verse while it was on screen. Offsets are into this verse only, so ranges falling outside its text are discarded.',
                  items: {
                    $ref: '#/components/schemas/BibleBookmarkStyleRange',
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Bookmark created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/BibleBookmark' },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    delete: {
      tags: ['Bible'],
      summary: 'Clear all bookmarks',
      description: 'Removes every bookmarked verse and every note.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': successResponse,
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/bible-bookmarks/{id}': {
    delete: {
      tags: ['Bible'],
      summary: 'Remove one bookmark',
      description:
        'Removes a single bookmark row. Keyed on the bookmark ID rather than the verse ID, so duplicate bookmarks of one verse are removed independently.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Bookmark row ID',
        },
      ],
      responses: {
        '200': successResponse,
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/bible-bookmarks/export': {
    get: {
      tags: ['Bible'],
      summary: 'Export bookmarks as text',
      description:
        'Renders the list as plain text: a reference per line, its verse text indented underneath, notes wrapped in dashes. The result can be pasted back into the import endpoint unchanged.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'The rendered text',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { data: { type: 'string' } },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/bible-bookmarks/import': {
    post: {
      tags: ['Bible'],
      summary: 'Import bookmarks from text',
      description:
        'Parses text and appends what it finds to the existing list. References are resolved against the real translation, ranges such as "Ioan 3:16-18" expand into one bookmark per verse, and a reference may name its own translation with a trailing " - ABBR". Lines that cannot be used are reported back with their line number rather than dropped.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['text'],
              properties: {
                text: { type: 'string', description: 'The text to parse' },
                translationId: {
                  type: 'integer',
                  description:
                    'Translation used for references that do not name one. Defaults to the default translation.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'What was imported, and which lines were skipped',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/BibleBookmarkImportResult',
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
  '/api/bible-bookmarks/reorder-items': {
    put: {
      tags: ['Bible'],
      summary: 'Reorder bookmarks and notes',
      description:
        'Rewrites the order of the whole list. Send every row, not just the moved ones: verses and notes share one sequence, so a partial list would interleave them wrongly.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items'],
              properties: {
                items: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/BibleBookmarkItemRef' },
                },
              },
            },
          },
        },
      },
      responses: {
        '200': successResponse,
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/bible-bookmark-notes': {
    get: {
      tags: ['Bible'],
      summary: 'List bookmark notes',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'The notes, in list order',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/BibleBookmarkNote' },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Bible'],
      summary: 'Add a note',
      description:
        'Appends a free-text heading to the end of the bookmark list.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['content'],
              properties: { content: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Note created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/BibleBookmarkNote' },
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
  '/api/bible-bookmark-notes/{id}': {
    put: {
      tags: ['Bible'],
      summary: 'Rewrite a note',
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
            schema: {
              type: 'object',
              required: ['content'],
              properties: { content: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        '200': successResponse,
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    delete: {
      tags: ['Bible'],
      summary: 'Delete a note',
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
        '200': successResponse,
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
}

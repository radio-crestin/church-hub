export const biblePaths = {
  '/api/bible/translations': {
    get: {
      tags: ['Bible'],
      summary: 'List all Bible translations',
      description: 'Returns all imported Bible translations',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'List of translations',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/BibleTranslation' },
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
      summary: 'Import Bible translation',
      description:
        'Import a Bible translation. Supports OSIS XML and Holy-Bible-XML-Format.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateBibleTranslationInput',
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Translation imported successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/BibleTranslation' },
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
  '/api/bible/translations/{id}': {
    get: {
      tags: ['Bible'],
      summary: 'Get translation by ID',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Translation ID',
        },
      ],
      responses: {
        '200': {
          description: 'Translation details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/BibleTranslation' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Bible'],
      summary: 'Delete translation',
      description: 'Delete a Bible translation and all its data',
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
          description: 'Translation deleted',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/OperationResult' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/bible/books/{translationId}': {
    get: {
      tags: ['Bible'],
      summary: 'Get books by translation',
      description: 'Returns all books in a translation',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'translationId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Translation ID',
        },
      ],
      responses: {
        '200': {
          description: 'List of books',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/BibleBook' },
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
  '/api/bible/chapters/{bookId}': {
    get: {
      tags: ['Bible'],
      summary: 'Get chapters for book',
      description: 'Returns chapters with verse counts for a book',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'bookId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Book ID',
        },
      ],
      responses: {
        '200': {
          description: 'List of chapters',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/BibleChapter' },
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
  '/api/bible/verses/{bookId}/{chapter}': {
    get: {
      tags: ['Bible'],
      summary: 'Get verses by chapter',
      description: 'Returns all verses in a chapter',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'bookId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Book ID',
        },
        {
          name: 'chapter',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Chapter number',
        },
      ],
      responses: {
        '200': {
          description: 'List of verses',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/BibleVerse' },
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
  '/api/bible/verse/{id}': {
    get: {
      tags: ['Bible'],
      summary: 'Get verse by ID',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Verse ID',
        },
      ],
      responses: {
        '200': {
          description: 'Verse details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/BibleVerse' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/bible/next-verse/{verseId}': {
    get: {
      tags: ['Bible'],
      summary: 'Get next sequential verse',
      description:
        'Returns the next verse in the Bible sequence. Handles chapter and book boundaries automatically.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'verseId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Current verse ID',
        },
      ],
      responses: {
        '200': {
          description: 'Next verse (or null if at end of Bible)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    oneOf: [
                      { $ref: '#/components/schemas/BibleVerse' },
                      { type: 'null' },
                    ],
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
  '/api/bible/search': {
    get: {
      tags: ['Bible'],
      summary: 'Search Bible',
      description: 'Search by reference (e.g., "Gen 1:1") or by text content',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: true,
          schema: { type: 'string' },
          description: 'Search query (reference or text)',
        },
        {
          name: 'translationId',
          in: 'query',
          schema: { type: 'integer' },
          description: 'Translation ID to search in',
        },
      ],
      responses: {
        '200': {
          description: 'Search results',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/BibleSearchResponse' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/bible/available': {
    get: {
      tags: ['Bible'],
      summary: 'Get available Bible translations for download',
      description:
        'Proxy endpoint that fetches available Bible translations from Holy-Bible-XML-Format repository. Returns XML list of 1045+ translations.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'XML list of available Bible translations',
          content: {
            'application/xml': {
              schema: { type: 'string' },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '502': {
          description: 'Failed to fetch from upstream repository',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/bible/download': {
    get: {
      tags: ['Bible'],
      summary: 'Download a Bible XML file',
      description:
        'Proxy endpoint that downloads a Bible XML file from Holy-Bible-XML-Format repository. Only URLs from the Holy-Bible-XML-Format repository are allowed.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'url',
          in: 'query',
          required: true,
          schema: { type: 'string', format: 'uri' },
          description:
            'The URL of the Bible XML file to download (must be from Holy-Bible-XML-Format repository)',
        },
      ],
      responses: {
        '200': {
          description: 'Bible XML content',
          content: {
            'application/xml': {
              schema: { type: 'string' },
            },
          },
        },
        '400': {
          description: 'Missing url parameter',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': {
          description: 'URL not allowed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                },
              },
            },
          },
        },
        '502': {
          description: 'Failed to download from upstream',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
}

export const songsPaths = {
  '/api/songs/search': {
    get: {
      tags: ['Songs'],
      summary: 'Search songs',
      description: 'Search songs by title or content with highlighted matches',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: true,
          schema: { type: 'string' },
          description: 'Search query',
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
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/SongSearchResult' },
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
  '/api/songs/search/rebuild': {
    post: {
      tags: ['Songs'],
      summary: 'Rebuild FTS search index',
      description:
        'Rebuilds the full-text search index for all songs. Useful after batch imports or when search results seem incorrect.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'Search index rebuilt successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        description: 'Whether the rebuild succeeded',
                      },
                      duration: {
                        type: 'integer',
                        description: 'Time taken in milliseconds',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '500': {
          description: 'Rebuild failed',
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
  '/api/songs': {
    get: {
      tags: ['Songs'],
      summary: 'List all songs',
      description: 'Returns all songs in the database',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'List of songs',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Song' },
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
      tags: ['Songs'],
      summary: 'Create or update song',
      description:
        'Creates a new song or updates an existing one if id is provided',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpsertSongInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Song created/updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/SongWithSlides' },
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
  '/api/songs/batch': {
    post: {
      tags: ['Songs'],
      summary: 'Batch import songs',
      description: 'Import multiple songs at once',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['songs'],
              properties: {
                songs: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/BatchImportSongInput',
                  },
                },
                categoryId: {
                  type: 'integer',
                  nullable: true,
                  description: 'Default category ID for imported songs',
                },
                overwriteDuplicates: {
                  type: 'boolean',
                  description:
                    'Whether to overwrite existing songs with same title',
                },
                skipManuallyEdited: {
                  type: 'boolean',
                  description:
                    'Skip songs that were manually edited (only used when overwriteDuplicates is true)',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Batch import result',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/BatchImportResult' },
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
  '/api/songs/{id}': {
    get: {
      tags: ['Songs'],
      summary: 'Get song by ID',
      description: 'Returns a song with all its slides and category',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Song ID',
        },
      ],
      responses: {
        '200': {
          description: 'Song with slides',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/SongWithSlides' },
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
      tags: ['Songs'],
      summary: 'Delete song',
      description: 'Delete a song and all its slides',
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
          description: 'Song deleted',
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
  '/api/songs/{id}/slides/reorder': {
    put: {
      tags: ['Song Slides'],
      summary: 'Reorder song slides',
      description:
        'Reorder slides within a song by providing ordered slide IDs',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Song ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ReorderSongSlidesInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Slides reordered',
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
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/song-slides': {
    post: {
      tags: ['Song Slides'],
      summary: 'Create or update song slide',
      description:
        'Creates a new slide or updates an existing one if id is provided',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpsertSongSlideInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Slide created/updated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/SongSlide' },
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
  '/api/song-slides/{id}': {
    delete: {
      tags: ['Song Slides'],
      summary: 'Delete song slide',
      description: 'Delete a song slide by ID',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Slide ID',
        },
      ],
      responses: {
        '200': {
          description: 'Slide deleted',
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
  '/api/song-slides/{id}/clone': {
    post: {
      tags: ['Song Slides'],
      summary: 'Clone song slide',
      description: 'Create a duplicate of an existing slide',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Slide ID to clone',
        },
      ],
      responses: {
        '200': {
          description: 'Cloned slide',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/SongSlide' },
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
}

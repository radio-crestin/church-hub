export const songSchemas = {
  SongCategory: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      priority: {
        type: 'integer',
        description: 'Priority for search ranking (higher = more important)',
      },
      songCount: {
        type: 'integer',
        description: 'Number of songs in this category',
      },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  Song: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
      categoryId: { type: 'integer', nullable: true },
      sourceFilename: { type: 'string', nullable: true },
      author: { type: 'string', nullable: true },
      copyright: { type: 'string', nullable: true },
      ccli: { type: 'string', nullable: true },
      tempo: { type: 'string', nullable: true },
      timeSignature: { type: 'string', nullable: true },
      theme: { type: 'string', nullable: true },
      altTheme: { type: 'string', nullable: true },
      hymnNumber: { type: 'string', nullable: true },
      keyLine: { type: 'string', nullable: true },
      presentationOrder: { type: 'string', nullable: true },
      presentationCount: {
        type: 'integer',
        description: 'Number of times the song was presented',
      },
      lastPresentedAt: {
        type: 'integer',
        nullable: true,
        description: 'Unix timestamp of when the song was last presented',
      },
      lastManualEdit: {
        type: 'integer',
        nullable: true,
        description: 'Unix timestamp of last manual edit from UI',
      },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  SongSlide: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      songId: { type: 'integer' },
      content: { type: 'string' },
      sortOrder: { type: 'integer' },
      label: { type: 'string', nullable: true },
      createdAt: { type: 'integer', description: 'Unix timestamp' },
      updatedAt: { type: 'integer', description: 'Unix timestamp' },
    },
  },
  SongWithSlides: {
    allOf: [
      { $ref: '#/components/schemas/Song' },
      {
        type: 'object',
        properties: {
          slides: {
            type: 'array',
            items: { $ref: '#/components/schemas/SongSlide' },
          },
          category: {
            oneOf: [
              { $ref: '#/components/schemas/SongCategory' },
              { type: 'null' },
            ],
          },
        },
      },
    ],
  },
  SongSearchResult: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
      categoryId: { type: 'integer', nullable: true },
      categoryName: { type: 'string', nullable: true },
      highlightedTitle: { type: 'string' },
      matchedContent: { type: 'string' },
    },
  },
  UpsertSongInput: {
    type: 'object',
    required: ['title'],
    properties: {
      id: {
        type: 'integer',
        description: 'If provided, updates existing song',
      },
      title: { type: 'string' },
      categoryId: { type: 'integer', nullable: true },
      sourceFilename: { type: 'string', nullable: true },
      author: { type: 'string', nullable: true },
      copyright: { type: 'string', nullable: true },
      ccli: { type: 'string', nullable: true },
      tempo: { type: 'string', nullable: true },
      timeSignature: { type: 'string', nullable: true },
      theme: { type: 'string', nullable: true },
      altTheme: { type: 'string', nullable: true },
      hymnNumber: { type: 'string', nullable: true },
      keyLine: { type: 'string', nullable: true },
      presentationOrder: { type: 'string', nullable: true },
      slides: {
        type: 'array',
        items: {
          type: 'object',
          required: ['content', 'sortOrder'],
          properties: {
            id: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
            content: { type: 'string' },
            sortOrder: { type: 'integer' },
            label: { type: 'string', nullable: true },
          },
        },
      },
    },
  },
  UpsertSongSlideInput: {
    type: 'object',
    required: ['songId', 'content'],
    properties: {
      id: {
        type: 'integer',
        description: 'If provided, updates existing slide',
      },
      songId: { type: 'integer' },
      content: { type: 'string' },
      sortOrder: { type: 'integer' },
      label: { type: 'string', nullable: true },
    },
  },
  ReorderSongSlidesInput: {
    type: 'object',
    required: ['slideIds'],
    properties: {
      slideIds: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Ordered array of slide IDs',
      },
    },
  },
  BatchImportSongInput: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string' },
      categoryId: { type: 'integer', nullable: true },
      sourceFilename: { type: 'string', nullable: true },
      author: { type: 'string', nullable: true },
      copyright: { type: 'string', nullable: true },
      ccli: { type: 'string', nullable: true },
      tempo: { type: 'string', nullable: true },
      timeSignature: { type: 'string', nullable: true },
      theme: { type: 'string', nullable: true },
      altTheme: { type: 'string', nullable: true },
      hymnNumber: { type: 'string', nullable: true },
      keyLine: { type: 'string', nullable: true },
      presentationOrder: { type: 'string', nullable: true },
      slides: {
        type: 'array',
        items: {
          type: 'object',
          required: ['content', 'sortOrder'],
          properties: {
            content: { type: 'string' },
            sortOrder: { type: 'integer' },
            label: { type: 'string', nullable: true },
          },
        },
      },
    },
  },
  BatchImportResult: {
    type: 'object',
    properties: {
      successCount: { type: 'integer' },
      failedCount: { type: 'integer' },
      skippedCount: {
        type: 'integer',
        description: 'Number of songs skipped (e.g., manually edited songs)',
      },
      songIds: {
        type: 'array',
        items: { type: 'integer' },
      },
      errors: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
  UpsertCategoryInput: {
    type: 'object',
    required: ['name'],
    properties: {
      id: {
        type: 'integer',
        description: 'If provided, updates existing category',
      },
      name: { type: 'string' },
      priority: {
        type: 'integer',
        description: 'Priority for search ranking',
      },
    },
  },
  ReorderCategoriesInput: {
    type: 'object',
    required: ['categoryIds'],
    properties: {
      categoryIds: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Ordered array of category IDs (first = highest priority)',
      },
    },
  },
}

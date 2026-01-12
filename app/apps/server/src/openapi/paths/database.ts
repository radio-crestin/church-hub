export const databasePaths: Record<string, Record<string, unknown>> = {
  '/api/database/info': {
    get: {
      tags: ['Database'],
      summary: 'Get database information',
      description:
        'Returns information about the SQLite database including path, size, and data directory. Only accessible from localhost.',
      responses: {
        '200': {
          description: 'Database information',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      path: {
                        type: 'string',
                        description: 'Full path to the database file',
                      },
                      dataDir: {
                        type: 'string',
                        description: 'Data directory containing the database',
                      },
                      sizeBytes: {
                        type: 'integer',
                        description: 'Size of the database file in bytes',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '403': {
          description: 'Only accessible from localhost',
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
  '/api/database/export': {
    post: {
      tags: ['Database'],
      summary: 'Export database to a file',
      description:
        'Checkpoints the WAL and exports the database to the specified path. Only accessible from localhost.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['destinationPath'],
              properties: {
                destinationPath: {
                  type: 'string',
                  description:
                    'Full path where the database backup will be saved',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Database exported successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      exportedPath: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        '400': {
          description: 'Missing destinationPath',
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
        '403': {
          description: 'Only accessible from localhost',
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
        '500': {
          description: 'Export failed',
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
  '/api/database/import': {
    post: {
      tags: ['Database'],
      summary: 'Import database from a file',
      description:
        'Imports data from the specified database file. When options are provided, performs selective import of chosen categories without replacing the entire database. Without options, replaces the entire database. Only accessible from localhost.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['sourcePath'],
              properties: {
                sourcePath: {
                  type: 'string',
                  description: 'Full path to the database file to import',
                },
                options: {
                  type: 'object',
                  description:
                    'Import options for selective import. If not provided, entire database is replaced.',
                  properties: {
                    songs: {
                      type: 'boolean',
                      description:
                        'Import songs (song_categories, songs, song_slides)',
                    },
                    bible: {
                      type: 'boolean',
                      description:
                        'Import Bible data (bible_translations, bible_books, bible_verses)',
                    },
                    schedules: {
                      type: 'boolean',
                      description: 'Import schedules and related items',
                    },
                    configurations: {
                      type: 'boolean',
                      description:
                        'Import configuration (screens, settings, preferences)',
                    },
                    copyAndMigrate: {
                      type: 'boolean',
                      description:
                        'Copy database file and run migrations to update schema. Use this when importing from older versions.',
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Database imported successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      requiresRestart: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        '400': {
          description: 'Missing sourcePath',
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
        '403': {
          description: 'Only accessible from localhost',
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
        '500': {
          description: 'Import failed',
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
  '/api/database/factory-reset': {
    post: {
      tags: ['Database'],
      summary: 'Factory reset application settings',
      description:
        'Resets application configuration to defaults by clearing screens and app settings, then re-seeding from fixture files. Optionally reset Bible translations and songs. Only accessible from localhost.',
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                includeBibles: {
                  type: 'boolean',
                  default: false,
                  description:
                    'Also reset Bible translations to default fixtures',
                },
                includeSongs: {
                  type: 'boolean',
                  default: false,
                  description:
                    'Also reset songs and categories to default fixtures',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Factory reset completed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        '403': {
          description: 'Only accessible from localhost',
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
        '500': {
          description: 'Factory reset failed',
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
  '/api/database/rebuild-search-indexes': {
    post: {
      tags: ['Database'],
      summary: 'Rebuild search indexes',
      description:
        'Rebuilds FTS (Full-Text Search) indexes. By default rebuilds all indexes (songs, schedules, Bible). Use options to rebuild specific indexes only. Only accessible from localhost.',
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                songs: {
                  type: 'boolean',
                  description: 'Rebuild songs search index',
                },
                schedules: {
                  type: 'boolean',
                  description: 'Rebuild schedules search index',
                },
                bible: {
                  type: 'boolean',
                  description: 'Rebuild Bible verses search index',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Search indexes rebuilt successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      duration: {
                        type: 'integer',
                        description: 'Time taken in milliseconds',
                      },
                      indexes: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of indexes that were rebuilt',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '403': {
          description: 'Only accessible from localhost',
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
}

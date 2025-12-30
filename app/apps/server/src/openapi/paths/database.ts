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
        'Imports a database from the specified path, replacing the current database. Creates a backup before replacing. Requires app restart after successful import. Only accessible from localhost.',
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
}

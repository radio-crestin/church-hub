export const databasePaths = {
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
}

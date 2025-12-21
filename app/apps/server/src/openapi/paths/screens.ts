export const screensPaths = {
  '/api/screens': {
    get: {
      tags: ['Screens'],
      summary: 'List all screens',
      description: 'Returns all screen configurations ordered by sort order',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': {
          description: 'List of screens',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Screen' },
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
      tags: ['Screens'],
      summary: 'Create or update screen',
      description:
        'Creates a new screen or updates an existing one. Default content configs are created for new screens.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpsertScreenInput' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Screen updated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Screen' },
                },
              },
            },
          },
        },
        '201': {
          description: 'Screen created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Screen' },
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
  '/api/screens/{id}': {
    get: {
      tags: ['Screens'],
      summary: 'Get screen by ID with all configs',
      description:
        'Returns a screen with all content type configurations and next slide config',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Screen ID',
        },
      ],
      responses: {
        '200': {
          description: 'Screen with configurations',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/ScreenWithConfigs' },
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
      tags: ['Screens'],
      summary: 'Delete screen',
      description: 'Deletes a screen and all its configurations (cascade)',
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
          description: 'Screen deleted',
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
  '/api/screens/{id}/config/{contentType}': {
    put: {
      tags: ['Screens'],
      summary: 'Update content-specific config',
      description:
        'Updates the rendering configuration for a specific content type',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Screen ID',
        },
        {
          name: 'contentType',
          in: 'path',
          required: true,
          schema: { $ref: '#/components/schemas/ContentType' },
          description: 'Content type to configure',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                config: {
                  type: 'object',
                  description: 'Content-specific configuration object',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Config updated',
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
  '/api/screens/{id}/next-slide-config': {
    put: {
      tags: ['Screens'],
      summary: 'Update next slide section config',
      description:
        'Updates the next slide preview section configuration (for stage screens)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Screen ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                config: {
                  $ref: '#/components/schemas/NextSlideSectionConfig',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Config updated',
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
  '/api/screens/{id}/global-settings': {
    put: {
      tags: ['Screens'],
      summary: 'Update global screen settings',
      description:
        'Updates the global settings like default background and clock config',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Screen ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                settings: {
                  $ref: '#/components/schemas/ScreenGlobalSettings',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Settings updated',
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
}

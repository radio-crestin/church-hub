export const settingsPaths = {
  '/api/settings/{table}': {
    get: {
      tags: ['Settings'],
      summary: 'Get all settings from a table',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'table',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['app_settings', 'user_preferences', 'cache_metadata'],
          },
          description: 'Settings table name',
        },
      ],
      responses: {
        '200': {
          description: 'List of settings',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Setting' },
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
      tags: ['Settings'],
      summary: 'Create or update a setting',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'table',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['app_settings', 'user_preferences', 'cache_metadata'],
          },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['key', 'value'],
              properties: {
                key: { type: 'string', description: 'Setting key' },
                value: { type: 'string', description: 'Setting value' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Setting upserted successfully',
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
  '/api/settings/{table}/{key}': {
    get: {
      tags: ['Settings'],
      summary: 'Get a setting by key',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'table',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['app_settings', 'user_preferences', 'cache_metadata'],
          },
        },
        {
          name: 'key',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Setting key',
        },
      ],
      responses: {
        '200': {
          description: 'Setting value or null if not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    oneOf: [
                      { $ref: '#/components/schemas/Setting' },
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
    delete: {
      tags: ['Settings'],
      summary: 'Delete a setting',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'table',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['app_settings', 'user_preferences', 'cache_metadata'],
          },
        },
        {
          name: 'key',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'Setting deleted',
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
}

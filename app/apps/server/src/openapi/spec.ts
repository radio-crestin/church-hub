/**
 * OpenAPI 3.1 Specification for Church Hub API
 */
export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Church Hub API',
    version: '1.0.0',
    description:
      'API for Church Hub application - manage songs, schedules, presentations, and device access',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Settings', description: 'Application and user settings' },
    { name: 'Devices', description: 'Device management and authorization' },
    { name: 'Authentication', description: 'Device authentication' },
  ],
  paths: {
    '/': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description:
          'Returns a simple greeting to confirm the server is running',
        responses: {
          '200': {
            description: 'Server is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'string', example: 'Hello from Bun!' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/ping': {
      get: {
        tags: ['Health'],
        summary: 'Ping endpoint',
        description: 'Returns pong to confirm connectivity',
        responses: {
          '200': {
            description: 'Pong response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'string', example: 'pong' },
                  },
                },
              },
            },
          },
        },
      },
    },
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
            description: 'Setting found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Setting' },
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
    '/api/devices': {
      get: {
        tags: ['Devices'],
        summary: 'List all devices',
        description:
          'Returns all registered devices with their permissions. Admin only.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of devices',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/DeviceWithPermissions',
                      },
                    },
                  },
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['Devices'],
        summary: 'Create a new device',
        description:
          'Creates a new device with specified permissions. Returns the device and its authentication token (token only shown once). Admin only.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateDeviceInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Device created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/CreateDeviceResult' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/devices/{id}': {
      get: {
        tags: ['Devices'],
        summary: 'Get device by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Device ID',
          },
        ],
        responses: {
          '200': {
            description: 'Device details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      $ref: '#/components/schemas/DeviceWithPermissions',
                    },
                  },
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Devices'],
        summary: 'Update device',
        description: 'Update device name or active status. Admin only.',
        security: [{ bearerAuth: [] }],
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
              schema: { $ref: '#/components/schemas/UpdateDeviceInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Device updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      $ref: '#/components/schemas/DeviceWithPermissions',
                    },
                  },
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
      delete: {
        tags: ['Devices'],
        summary: 'Delete device',
        description: 'Delete a device and revoke its access. Admin only.',
        security: [{ bearerAuth: [] }],
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
            description: 'Device deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/devices/{id}/permissions': {
      put: {
        tags: ['Devices'],
        summary: 'Update device permissions',
        description:
          'Update the permissions for a specific device. Admin only.',
        security: [{ bearerAuth: [] }],
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
                required: ['permissions'],
                properties: {
                  permissions: {
                    $ref: '#/components/schemas/DevicePermissions',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Permissions updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      $ref: '#/components/schemas/DeviceWithPermissions',
                    },
                  },
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/devices/{id}/regenerate-token': {
      post: {
        tags: ['Devices'],
        summary: 'Regenerate device token',
        description:
          'Generates a new authentication token for the device, invalidating the old one. Admin only.',
        security: [{ bearerAuth: [] }],
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
            description: 'Token regenerated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/CreateDeviceResult' },
                  },
                },
              },
            },
          },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/auth/device/{token}': {
      get: {
        tags: ['Authentication'],
        summary: 'Authenticate device',
        description:
          'Authenticates a device using its token and sets an authentication cookie. Redirects to the main app on success.',
        parameters: [
          {
            name: 'token',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Device authentication token',
          },
        ],
        responses: {
          '302': {
            description: 'Authentication successful, redirecting to app',
            headers: {
              'Set-Cookie': {
                description: 'Authentication cookie',
                schema: { type: 'string' },
              },
              Location: {
                description: 'Redirect location',
                schema: { type: 'string', example: '/' },
              },
            },
          },
          '401': {
            description: 'Invalid or inactive device token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for Tauri app authentication',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'device_auth',
        description: 'Cookie-based authentication for external devices',
      },
    },
    schemas: {
      Setting: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          key: { type: 'string' },
          value: { type: 'string' },
          created_at: { type: 'integer', description: 'Unix timestamp' },
          updated_at: { type: 'integer', description: 'Unix timestamp' },
        },
      },
      OperationResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' },
        },
      },
      FeaturePermissions: {
        type: 'object',
        properties: {
          read: { type: 'boolean' },
          write: { type: 'boolean' },
          delete: { type: 'boolean' },
        },
      },
      DevicePermissions: {
        type: 'object',
        properties: {
          songs: { $ref: '#/components/schemas/FeaturePermissions' },
          schedules: { $ref: '#/components/schemas/FeaturePermissions' },
          presentation: { $ref: '#/components/schemas/FeaturePermissions' },
          settings: { $ref: '#/components/schemas/FeaturePermissions' },
        },
      },
      DeviceWithPermissions: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          isActive: { type: 'boolean' },
          lastUsedAt: { type: 'integer', nullable: true },
          createdAt: { type: 'integer' },
          updatedAt: { type: 'integer' },
          permissions: { $ref: '#/components/schemas/DevicePermissions' },
        },
      },
      CreateDeviceInput: {
        type: 'object',
        required: ['name', 'permissions'],
        properties: {
          name: { type: 'string', example: 'Living Room TV' },
          permissions: { $ref: '#/components/schemas/DevicePermissions' },
        },
      },
      UpdateDeviceInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
      CreateDeviceResult: {
        type: 'object',
        properties: {
          device: { $ref: '#/components/schemas/DeviceWithPermissions' },
          token: {
            type: 'string',
            description: 'Device authentication token (only shown once)',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      Forbidden: {
        description: 'Admin access required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      BadRequest: {
        description: 'Invalid request body',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
}

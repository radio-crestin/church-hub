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
    { name: 'Songs', description: 'Song management' },
    { name: 'Song Slides', description: 'Song slide management' },
    { name: 'Categories', description: 'Song categories' },
    { name: 'Queue', description: 'Presentation queue management' },
    { name: 'Schedules', description: 'Schedule management' },
    { name: 'Displays', description: 'Display configuration' },
    { name: 'Presentation', description: 'Presentation state control' },
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
    // Songs API
    '/api/songs/search': {
      get: {
        tags: ['Songs'],
        summary: 'Search songs',
        description:
          'Search songs by title or content with highlighted matches',
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
    // Song Slides API
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
    // Categories API
    '/api/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List all categories',
        description: 'Returns all song categories',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of categories',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/SongCategory' },
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
        tags: ['Categories'],
        summary: 'Create or update category',
        description: 'Creates a new category or updates an existing one',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpsertCategoryInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Category created/updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/SongCategory' },
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
    '/api/categories/{id}': {
      delete: {
        tags: ['Categories'],
        summary: 'Delete category',
        description: 'Delete a song category',
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
            description: 'Category deleted',
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
    '/api/categories/reorder': {
      put: {
        tags: ['Categories'],
        summary: 'Reorder categories',
        description:
          'Reorder categories by priority. First item in array gets highest priority.',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReorderCategoriesInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Categories reordered',
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
    // Queue API
    '/api/queue': {
      get: {
        tags: ['Queue'],
        summary: 'Get queue items',
        description:
          'Returns all items in the presentation queue with their slides',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          '200': {
            description: 'Queue items',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/QueueItem' },
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
        tags: ['Queue'],
        summary: 'Add song to queue',
        description: 'Add a song to the presentation queue',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddToQueueInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Song added to queue',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/QueueItem' },
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
        tags: ['Queue'],
        summary: 'Clear queue',
        description: 'Remove all items from the queue',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          '200': {
            description: 'Queue cleared',
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
        },
      },
    },
    '/api/queue/slide': {
      post: {
        tags: ['Queue'],
        summary: 'Insert standalone slide',
        description:
          'Insert a standalone slide (announcement, etc.) into the queue',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InsertSlideInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Slide inserted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/QueueItem' },
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
    '/api/queue/slide/{id}': {
      put: {
        tags: ['Queue'],
        summary: 'Update standalone slide',
        description: 'Update content of a standalone slide in the queue',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Queue item ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateSlideInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Slide updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/QueueItem' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/queue/{id}': {
      delete: {
        tags: ['Queue'],
        summary: 'Remove item from queue',
        description: 'Remove a specific item from the queue',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Queue item ID',
          },
        ],
        responses: {
          '200': {
            description: 'Item removed',
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
    '/api/queue/reorder': {
      put: {
        tags: ['Queue'],
        summary: 'Reorder queue items',
        description: 'Reorder items in the queue by providing ordered item IDs',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReorderQueueInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Queue reordered',
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
    '/api/queue/{id}/expand': {
      put: {
        tags: ['Queue'],
        summary: 'Set queue item expanded state',
        description: 'Set whether a queue item is expanded to show its slides',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Queue item ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['isExpanded'],
                properties: {
                  isExpanded: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Expanded state updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/QueueItem' },
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
    // Schedules API
    '/api/schedules/search': {
      get: {
        tags: ['Schedules'],
        summary: 'Search schedules',
        description: 'Search schedules by title or song content',
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
                      items: {
                        $ref: '#/components/schemas/ScheduleSearchResult',
                      },
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
    '/api/schedules': {
      get: {
        tags: ['Schedules'],
        summary: 'List all schedules',
        description: 'Returns all schedules',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of schedules',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Schedule' },
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
        tags: ['Schedules'],
        summary: 'Create or update schedule',
        description: 'Creates a new schedule or updates an existing one',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpsertScheduleInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Schedule created/updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Schedule' },
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
    '/api/schedules/{id}': {
      get: {
        tags: ['Schedules'],
        summary: 'Get schedule by ID',
        description: 'Returns a schedule with all its items and slides',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Schedule ID',
          },
        ],
        responses: {
          '200': {
            description: 'Schedule with items',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/ScheduleWithItems' },
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
        tags: ['Schedules'],
        summary: 'Delete schedule',
        description: 'Delete a schedule and all its items',
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
            description: 'Schedule deleted',
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
    '/api/schedules/{id}/items': {
      post: {
        tags: ['Schedules'],
        summary: 'Add item to schedule',
        description: 'Add a song or standalone slide to a schedule',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Schedule ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  songId: { type: 'integer', description: 'Song ID to add' },
                  slideType: { $ref: '#/components/schemas/SlideTemplate' },
                  slideContent: { type: 'string' },
                  afterItemId: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Item added',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/ScheduleItem' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/schedules/{id}/items/{itemId}': {
      put: {
        tags: ['Schedules'],
        summary: 'Update slide in schedule',
        description: 'Update a standalone slide item in the schedule',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Schedule ID',
          },
          {
            name: 'itemId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Schedule item ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['slideType', 'slideContent'],
                properties: {
                  slideType: { $ref: '#/components/schemas/SlideTemplate' },
                  slideContent: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Item updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/ScheduleItem' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Schedules'],
        summary: 'Remove item from schedule',
        description: 'Remove an item from the schedule',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Schedule ID',
          },
          {
            name: 'itemId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Schedule item ID',
          },
        ],
        responses: {
          '200': {
            description: 'Item removed',
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
    '/api/schedules/{id}/items/reorder': {
      put: {
        tags: ['Schedules'],
        summary: 'Reorder schedule items',
        description:
          'Reorder items in a schedule by providing ordered item IDs',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Schedule ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ReorderScheduleItemsInput',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Items reordered',
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
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/schedules/{id}/import-to-queue': {
      post: {
        tags: ['Schedules'],
        summary: 'Import schedule to queue',
        description:
          'Import all items from a schedule into the presentation queue',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Schedule ID',
          },
        ],
        responses: {
          '200': {
            description: 'Schedule imported to queue',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        itemsImported: { type: 'integer' },
                      },
                    },
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
    // Displays API
    '/api/displays': {
      get: {
        tags: ['Displays'],
        summary: 'List all displays',
        description: 'Returns all display configurations',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          '200': {
            description: 'List of displays',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Display' },
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
        tags: ['Displays'],
        summary: 'Create or update display',
        description: 'Creates a new display or updates an existing one',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpsertDisplayInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Display created/updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Display' },
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
    '/api/displays/{id}': {
      get: {
        tags: ['Displays'],
        summary: 'Get display by ID',
        description: 'Returns a display configuration',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Display ID',
          },
        ],
        responses: {
          '200': {
            description: 'Display details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Display' },
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
        tags: ['Displays'],
        summary: 'Delete display',
        description: 'Delete a display configuration',
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
            description: 'Display deleted',
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
    '/api/displays/{id}/theme': {
      put: {
        tags: ['Displays'],
        summary: 'Update display theme',
        description: 'Update the theme settings for a display',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Display ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DisplayTheme' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Theme updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Display' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    // Presentation API
    '/api/presentation/state': {
      get: {
        tags: ['Presentation'],
        summary: 'Get presentation state',
        description:
          'Returns the current presentation state including active slide',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          '200': {
            description: 'Current presentation state',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/PresentationState' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      put: {
        tags: ['Presentation'],
        summary: 'Update presentation state',
        description:
          'Update the presentation state (current slide, presenting status)',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdatePresentationStateInput',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'State updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/PresentationState' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/presentation/stop': {
      post: {
        tags: ['Presentation'],
        summary: 'Stop presentation',
        description: 'Stop the current presentation and clear the state',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          '200': {
            description: 'Presentation stopped',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/PresentationState' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/presentation/clear': {
      post: {
        tags: ['Presentation'],
        summary: 'Clear/hide current slide',
        description: 'Hide the current slide temporarily (can be shown again)',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          '200': {
            description: 'Slide hidden',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/PresentationState' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/presentation/show': {
      post: {
        tags: ['Presentation'],
        summary: 'Show last displayed slide',
        description: 'Show the last displayed slide after clearing',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          '200': {
            description: 'Slide shown',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/PresentationState' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/presentation/navigate-queue': {
      post: {
        tags: ['Presentation'],
        summary: 'Navigate queue slides',
        description: 'Navigate to next or previous slide in the queue',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['direction'],
                properties: {
                  direction: {
                    type: 'string',
                    enum: ['next', 'prev'],
                    description: 'Navigation direction',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Navigation result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/PresentationState' },
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
      // Song Schemas
      SongCategory: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          priority: {
            type: 'integer',
            description:
              'Priority for search ranking (higher = more important)',
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
          sourceFilePath: { type: 'string', nullable: true },
          author: { type: 'string', nullable: true },
          copyright: { type: 'string', nullable: true },
          ccli: { type: 'string', nullable: true },
          key: { type: 'string', nullable: true },
          tempo: { type: 'string', nullable: true },
          timeSignature: { type: 'string', nullable: true },
          theme: { type: 'string', nullable: true },
          altTheme: { type: 'string', nullable: true },
          hymnNumber: { type: 'string', nullable: true },
          keyLine: { type: 'string', nullable: true },
          presentationOrder: { type: 'string', nullable: true },
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
          sourceFilePath: { type: 'string', nullable: true },
          author: { type: 'string', nullable: true },
          copyright: { type: 'string', nullable: true },
          ccli: { type: 'string', nullable: true },
          key: { type: 'string', nullable: true },
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
          sourceFilePath: { type: 'string', nullable: true },
          author: { type: 'string', nullable: true },
          copyright: { type: 'string', nullable: true },
          ccli: { type: 'string', nullable: true },
          key: { type: 'string', nullable: true },
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
            description:
              'Ordered array of category IDs (first = highest priority)',
          },
        },
      },
      // Queue Schemas
      SlideTemplate: {
        type: 'string',
        enum: ['announcement', 'versete_tineri'],
        description: 'Type of standalone slide template',
      },
      QueueItemType: {
        type: 'string',
        enum: ['song', 'slide'],
        description: 'Type of queue item',
      },
      QueueItem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          itemType: { $ref: '#/components/schemas/QueueItemType' },
          songId: { type: 'integer', nullable: true },
          song: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'integer' },
              title: { type: 'string' },
              categoryName: { type: 'string', nullable: true },
            },
          },
          slides: {
            type: 'array',
            items: { $ref: '#/components/schemas/SongSlide' },
          },
          slideType: { $ref: '#/components/schemas/SlideTemplate' },
          slideContent: { type: 'string', nullable: true },
          sortOrder: { type: 'integer' },
          isExpanded: { type: 'boolean' },
          createdAt: { type: 'integer', description: 'Unix timestamp' },
          updatedAt: { type: 'integer', description: 'Unix timestamp' },
        },
      },
      AddToQueueInput: {
        type: 'object',
        required: ['songId'],
        properties: {
          songId: { type: 'integer' },
          presentNow: {
            type: 'boolean',
            description: 'Whether to start presenting immediately',
          },
          afterItemId: {
            type: 'integer',
            description: 'Insert after this queue item ID',
          },
        },
      },
      InsertSlideInput: {
        type: 'object',
        required: ['slideType', 'slideContent'],
        properties: {
          slideType: { $ref: '#/components/schemas/SlideTemplate' },
          slideContent: { type: 'string' },
          afterItemId: {
            type: 'integer',
            description: 'Insert after this queue item ID',
          },
        },
      },
      UpdateSlideInput: {
        type: 'object',
        required: ['id', 'slideType', 'slideContent'],
        properties: {
          id: { type: 'integer' },
          slideType: { $ref: '#/components/schemas/SlideTemplate' },
          slideContent: { type: 'string' },
        },
      },
      ReorderQueueInput: {
        type: 'object',
        required: ['itemIds'],
        properties: {
          itemIds: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Ordered array of queue item IDs',
          },
        },
      },
      // Schedule Schemas
      Schedule: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          itemCount: { type: 'integer' },
          songCount: { type: 'integer' },
          createdAt: { type: 'integer', description: 'Unix timestamp' },
          updatedAt: { type: 'integer', description: 'Unix timestamp' },
        },
      },
      ScheduleItem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          scheduleId: { type: 'integer' },
          itemType: { $ref: '#/components/schemas/QueueItemType' },
          songId: { type: 'integer', nullable: true },
          song: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'integer' },
              title: { type: 'string' },
              categoryName: { type: 'string', nullable: true },
            },
          },
          slides: {
            type: 'array',
            items: { $ref: '#/components/schemas/SongSlide' },
          },
          slideType: { $ref: '#/components/schemas/SlideTemplate' },
          slideContent: { type: 'string', nullable: true },
          sortOrder: { type: 'integer' },
          createdAt: { type: 'integer', description: 'Unix timestamp' },
          updatedAt: { type: 'integer', description: 'Unix timestamp' },
        },
      },
      ScheduleWithItems: {
        allOf: [
          { $ref: '#/components/schemas/Schedule' },
          {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/ScheduleItem' },
              },
            },
          },
        ],
      },
      ScheduleSearchResult: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          itemCount: { type: 'integer' },
          matchedContent: { type: 'string' },
        },
      },
      UpsertScheduleInput: {
        type: 'object',
        required: ['title'],
        properties: {
          id: {
            type: 'integer',
            description: 'If provided, updates existing schedule',
          },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
        },
      },
      AddToScheduleInput: {
        type: 'object',
        required: ['scheduleId'],
        properties: {
          scheduleId: { type: 'integer' },
          songId: {
            type: 'integer',
            description: 'Add a song to the schedule',
          },
          slideType: { $ref: '#/components/schemas/SlideTemplate' },
          slideContent: {
            type: 'string',
            description: 'Content for standalone slide',
          },
          afterItemId: {
            type: 'integer',
            description: 'Insert after this item ID',
          },
        },
      },
      UpdateScheduleSlideInput: {
        type: 'object',
        required: ['id', 'slideType', 'slideContent'],
        properties: {
          id: { type: 'integer' },
          slideType: { $ref: '#/components/schemas/SlideTemplate' },
          slideContent: { type: 'string' },
        },
      },
      ReorderScheduleItemsInput: {
        type: 'object',
        required: ['itemIds'],
        properties: {
          itemIds: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Ordered array of schedule item IDs',
          },
        },
      },
      // Display Schemas
      BackgroundType: {
        type: 'string',
        enum: ['transparent', 'color', 'image'],
        description: 'Type of display background',
      },
      DisplayOpenMode: {
        type: 'string',
        enum: ['browser', 'native'],
        description: 'How the display opens - browser tab or native window',
      },
      DisplayTheme: {
        type: 'object',
        properties: {
          backgroundType: { $ref: '#/components/schemas/BackgroundType' },
          backgroundColor: { type: 'string', description: 'CSS color value' },
          backgroundImage: { type: 'string', description: 'Image URL' },
          textColor: { type: 'string', description: 'CSS color value' },
          fontFamily: { type: 'string' },
          padding: { type: 'number' },
        },
      },
      Display: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          isActive: { type: 'boolean' },
          openMode: { $ref: '#/components/schemas/DisplayOpenMode' },
          isFullscreen: { type: 'boolean' },
          theme: { $ref: '#/components/schemas/DisplayTheme' },
          createdAt: { type: 'integer', description: 'Unix timestamp' },
          updatedAt: { type: 'integer', description: 'Unix timestamp' },
        },
      },
      UpsertDisplayInput: {
        type: 'object',
        required: ['name'],
        properties: {
          id: {
            type: 'integer',
            description: 'If provided, updates existing display',
          },
          name: { type: 'string' },
          isActive: { type: 'boolean' },
          openMode: { $ref: '#/components/schemas/DisplayOpenMode' },
          isFullscreen: { type: 'boolean' },
          theme: { $ref: '#/components/schemas/DisplayTheme' },
        },
      },
      // Presentation Schemas
      PresentationState: {
        type: 'object',
        properties: {
          currentQueueItemId: { type: 'integer', nullable: true },
          currentSongSlideId: { type: 'integer', nullable: true },
          lastSongSlideId: { type: 'integer', nullable: true },
          isPresenting: { type: 'boolean' },
          isHidden: { type: 'boolean' },
          updatedAt: { type: 'integer', description: 'Unix timestamp' },
        },
      },
      UpdatePresentationStateInput: {
        type: 'object',
        properties: {
          currentQueueItemId: { type: 'integer', nullable: true },
          currentSongSlideId: { type: 'integer', nullable: true },
          lastSongSlideId: { type: 'integer', nullable: true },
          isPresenting: { type: 'boolean' },
          isHidden: { type: 'boolean' },
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

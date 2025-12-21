export const schedulesPaths = {
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
      description: 'Reorder items in a schedule by providing ordered item IDs',
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
}

export const presentationPaths = {
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
}

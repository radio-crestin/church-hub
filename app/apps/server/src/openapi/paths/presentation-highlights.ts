const highlightsResponse = {
  description: 'The highlights now on the slide',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/TextStyleRange' },
          },
        },
      },
    },
  },
}

export const presentationHighlightsPaths = {
  '/api/presentation/highlights': {
    get: {
      tags: ['Presentation'],
      summary: 'Get the highlights on the current slide',
      description:
        'Highlights apply to whatever is on screen right now, as character offsets into its text. They are a single global set and are cleared when the slide is hidden.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': highlightsResponse,
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Presentation'],
      summary: 'Add one highlight',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TextStyleRange' },
          },
        },
      },
      responses: {
        '200': highlightsResponse,
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    put: {
      tags: ['Presentation'],
      summary: 'Replace every highlight at once',
      description:
        'Used when a saved set is poured back onto the screen, for example from a Bible bookmark. Restoring one range at a time would broadcast a half-drawn slide to every connected screen. An empty array clears them.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['ranges'],
              properties: {
                ranges: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/TextStyleRange' },
                },
              },
            },
          },
        },
      },
      responses: {
        '200': highlightsResponse,
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    delete: {
      tags: ['Presentation'],
      summary: 'Clear every highlight',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': highlightsResponse,
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/presentation/highlights/{id}': {
    delete: {
      tags: ['Presentation'],
      summary: 'Remove one highlight',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'The range UUID',
        },
      ],
      responses: {
        '200': highlightsResponse,
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
}

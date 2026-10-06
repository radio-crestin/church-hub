export const conversionPaths = {
  '/api/convert/ppt-to-pptx': {
    post: {
      tags: ['Conversion'],
      summary: 'Parse PPT file',
      description:
        'Parses a legacy .ppt file and extracts slide text content. Uses built-in pure JS parser — no external dependencies required.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['data'],
              properties: {
                data: {
                  type: 'string',
                  description: 'Base64-encoded PPT file data',
                },
                filename: {
                  type: 'string',
                  description:
                    'Original filename (used for title extraction fallback)',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Parsing successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      slides: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            slideNumber: { type: 'integer' },
                            text: { type: 'string' },
                            htmlContent: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '500': { $ref: '#/components/responses/BadRequest' },
      },
    },
  },
}

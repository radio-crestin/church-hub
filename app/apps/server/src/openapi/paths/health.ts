export const healthPaths = {
  '/': {
    get: {
      tags: ['Health'],
      summary: 'API Documentation Redirect',
      description: 'Redirects to the API documentation at /api/docs',
      responses: {
        '302': {
          description: 'Redirect to API documentation',
          headers: {
            Location: {
              schema: { type: 'string', example: '/api/docs' },
              description: 'URL of the API documentation',
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
}

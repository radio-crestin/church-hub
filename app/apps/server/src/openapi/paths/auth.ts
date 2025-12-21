export const authPaths = {
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
}

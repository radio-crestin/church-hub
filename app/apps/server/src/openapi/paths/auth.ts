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
  '/api/auth/local-users': {
    get: {
      tags: ['Authentication'],
      summary: 'List users for the local login screen',
      description:
        'Public endpoint returning the minimal user list (id, name, isSuperAdmin, hasPassword) shown on the login screen. Never exposes tokens or permissions.',
      responses: {
        '200': {
          description: 'List of selectable users',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        isSuperAdmin: { type: 'boolean' },
                        hasPassword: { type: 'boolean' },
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
  },
  '/api/auth/login': {
    post: {
      tags: ['Authentication'],
      summary: 'Log in as a local user',
      description:
        'Verifies credentials and sets the `user_auth` session cookie. Passwordless login is only permitted for localhost requests; remote clients must supply a password.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userId'],
              properties: {
                userId: { type: 'integer' },
                password: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Login successful; session cookie set',
          headers: {
            'Set-Cookie': {
              description: 'Session cookie',
              schema: { type: 'string' },
            },
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/CurrentUser' },
                  ticket: {
                    type: 'string',
                    description:
                      'One-time ticket to finalize the session via GET /api/auth/login-redirect/{ticket} (top-level navigation).',
                  },
                },
              },
            },
          },
        },
        '401': {
          description: 'Invalid credentials',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
  },
  '/api/auth/login-redirect/{ticket}': {
    get: {
      tags: ['Authentication'],
      summary: 'Finalize a login via top-level navigation',
      description:
        'Consumes a one-time login ticket, sets the `user_auth` cookie on a 302 response (reliable cookie overwrite in webviews), and redirects back to the app. Used by "switch user".',
      parameters: [
        {
          name: 'ticket',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'return',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description:
            'App origin to return to (only same-machine origins are allowed).',
        },
      ],
      responses: {
        '302': {
          description: 'Session established; redirecting to the app',
          headers: {
            'Set-Cookie': {
              description: 'Session cookie',
              schema: { type: 'string' },
            },
            Location: { schema: { type: 'string' } },
          },
        },
      },
    },
  },
  '/api/auth/logout': {
    post: {
      tags: ['Authentication'],
      summary: 'Log out',
      description: 'Clears the `user_auth` session cookie.',
      responses: {
        '200': {
          description: 'Logged out',
          headers: {
            'Set-Cookie': {
              description: 'Cleared session cookie',
              schema: { type: 'string' },
            },
          },
        },
      },
    },
  },
  '/api/auth/me': {
    get: {
      tags: ['Authentication'],
      summary: 'Get the current session',
      description:
        'Returns the logged-in user and their permissions, or `data: null` when no session is active (server reachable but signed out).',
      responses: {
        '200': {
          description: 'Current user, or null when signed out',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    oneOf: [
                      { $ref: '#/components/schemas/CurrentUser' },
                      { type: 'null' },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

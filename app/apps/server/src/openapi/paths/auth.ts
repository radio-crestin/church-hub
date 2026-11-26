export const authPaths = {
  '/api/auth/user/{token}': {
    get: {
      tags: ['Authentication'],
      summary: 'Sign a device in as a user',
      description:
        "The link in a user's QR code (Settings > Users, Settings > Phones): sets the user's authentication cookie and redirects to the app on the host it was opened from.",
      parameters: [
        {
          name: 'token',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: "The user's token (usr_...)",
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
          description: 'Invalid or inactive user token',
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
  '/api/auth/device-login': {
    post: {
      tags: ['Authentication'],
      summary: 'Sign in a joined phone with its device token',
      description:
        "For a phone that joined the church with a link (cloud sync) and reaches this computer over WebRTC: the sync service is asked whose the device token is, and the answer is that user and their session token, which the phone sends back as `X-User-Auth` (a WebRTC tunnel carries no cookies). A revoked token, the church server's own, or a user who is unknown here or inactive is refused.",
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token'],
              properties: {
                token: {
                  type: 'string',
                  description: 'The device token of the join link.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Signed in',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/CurrentUser' },
                  token: {
                    type: 'string',
                    description: 'The session token, for `X-User-Auth`.',
                  },
                },
              },
            },
          },
        },
        '400': { description: 'No token' },
        '401': { description: 'The sync service refused the token' },
        '502': { description: 'The sync service did not answer' },
      },
    },
  },
  '/api/auth/login': {
    post: {
      tags: ['Authentication'],
      summary: 'Log in as a local user',
      description:
        'Verifies credentials and sets the `user_auth` session cookie. An account with a password needs it. A passwordless account signs in freely from this machine (judged by the TCP peer address, never the Host header); from another device the first attempt answers 401 `pairing_required` with a `pairingId` and shows a 6-digit code in the desktop app, and the next attempt sends `pairingId` and `code` (valid 2 minutes, 5 tries).',
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
                pairingId: {
                  type: 'string',
                  description:
                    'The pairing a previous `pairing_required` answer opened.',
                },
                code: {
                  type: 'string',
                  description: 'The 6-digit code shown in the desktop app.',
                },
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
          description:
            'Invalid credentials, or `pairing_required` (a code is now shown in the desktop app)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'pairing_required',
                  },
                  pairingId: { type: 'string' },
                  expiresAt: {
                    type: 'integer',
                    description: 'When the code expires (ms since epoch)',
                  },
                },
              },
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

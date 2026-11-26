const userLinkToken = {
  name: 'token',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description: "The user's token (usr_...)",
}

const signedInRedirect = {
  description: 'Signed in, redirecting to the app',
  headers: {
    'Set-Cookie': {
      description: 'Authentication cookie',
      schema: { type: 'string' },
    },
    Location: {
      description: 'The app on the host the link was opened from',
      schema: { type: 'string' },
    },
  },
}

const invalidUserLink = {
  description: 'Invalid or inactive user token',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
}

export const authPaths = {
  '/api/auth/user/{token}': {
    get: {
      tags: ['Authentication'],
      summary: 'Open a user sign-in link',
      description:
        "The link in a user's QR code (Settings > Users, Settings > Phones). Opened by the user (scanned, typed or pasted: `Sec-Fetch-Site` `none` or `same-origin`), it sets the user's authentication cookie and redirects to the app on the host it was opened from. Opened from another site's page, or without `Sec-Fetch-Site` (browsers send it only to https and to this machine, so every plain-http network address), it answers a page that asks the user to confirm, whose button posts the link back.",
      parameters: [userLinkToken],
      responses: {
        '200': {
          description: 'The confirmation page (opened from another page)',
          content: { 'text/html': { schema: { type: 'string' } } },
        },
        '302': signedInRedirect,
        '401': invalidUserLink,
      },
    },
    post: {
      tags: ['Authentication'],
      summary: 'Sign a device in with a user sign-in link',
      description:
        "The confirmation page's button: sets the user's authentication cookie and redirects to the app. Like every write, refused from an origin the server doesn't trust.",
      parameters: [userLinkToken],
      responses: {
        '303': signedInRedirect,
        '401': invalidUserLink,
        '403': {
          description: 'Sent from an origin the server does not trust',
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
                    example: 'signed-in',
                    description:
                      'Always `signed-in`: phone apps released before 2026-11-27 read it as the sign of success.',
                  },
                  token: {
                    type: 'string',
                    description:
                      'The session token, only to a request from this machine (the desktop app sends it back as `X-User-Auth`).',
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

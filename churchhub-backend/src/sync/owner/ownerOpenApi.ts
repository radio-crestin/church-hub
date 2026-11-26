/**
 * The OpenAPI paths of the owner's side of cloud sync (T-172), merged into
 * the service's document (openapi.ts).
 */
const error = (description: string) => ({
  description,
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/Error' } },
  },
})

const churchId = {
  name: 'churchId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
}

/** The church PC names itself on every call (see checkInstallation). */
export const installationHeaders = [
  {
    name: 'X-Church-Hub-Installation',
    in: 'header',
    schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,64}$' },
    description:
      'The calling install of the app. The church server’s token works for one installation at a time; another gets 409 server_in_use.',
  },
  {
    name: 'X-Church-Hub-Installation-Name',
    in: 'header',
    schema: { type: 'string' },
    description: 'The PC’s name, URI-encoded (shown to the other PC).',
  },
]

const ok = (description: string, properties: Record<string, unknown>) => ({
  description,
  content: {
    'application/json': { schema: { type: 'object', properties } },
  },
})

const credentials = ok('The church server’s new credentials (shown once)', {
  churchId: { type: 'string' },
  deviceId: { type: 'string' },
  serverToken: { type: 'string' },
  pathSecret: { type: 'string' },
  readUrl: { type: 'string' },
})

const ownerErrors = {
  '401': error('Missing, forged or expired owner ticket (owner_unauthorized)'),
  '403': error('The account does not own the church (not_owner)'),
  '404': error('No such church'),
}

export const ownerOpenApiPaths = {
  '/sync/churches/{churchId}/owner': {
    post: {
      summary: 'Claim a guest church',
      description:
        'The church server, signed in with Google, makes its guest church owned by that account. Nothing moves. The same account again is a no-op.',
      security: [{ deviceToken: [] }],
      parameters: [churchId, ...installationHeaders],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { ownerTicket: { type: 'string' } },
              required: ['ownerTicket'],
            },
          },
        },
      },
      responses: {
        '200': ok('Owned', { email: { type: 'string' } }),
        '401': error('Invalid device token or owner ticket'),
        '403': error('Not the church server’s token'),
        '409': error('Another account owns it (already_owned)'),
      },
    },
  },
  '/sync/churches/{churchId}/takeover': {
    post: {
      summary: 'This PC keeps the church server',
      description:
        'After a 409 server_in_use (the server token is on two PCs, e.g. a restored backup), the user picked this PC: its installation now holds the token and the other one is refused.',
      security: [{ deviceToken: [] }],
      parameters: [churchId, ...installationHeaders],
      responses: {
        '200': {
          description: 'Where to read',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Location' },
            },
          },
        },
        '401': error('Invalid token'),
        '403': error('Not the church server’s token'),
      },
    },
  },
  '/sync/owner/sign-in': {
    get: {
      summary: 'Start the owner’s Google sign-in',
      description:
        'Redirects to Google’s account chooser (scopes openid email). The PKCE verifier, the return URL and the PC’s nonce travel sealed in the OAuth state (AES-GCM, a key derived from SYNC_SECRET).',
      parameters: [
        {
          name: 'returnUrl',
          in: 'query',
          required: true,
          schema: { type: 'string' },
          description:
            'Where the ticket goes: http://localhost or 127.0.0.1 (the church PC), or an ALLOWED_ORIGINS page.',
        },
        {
          name: 'nonce',
          in: 'query',
          required: true,
          schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{16,128}$' },
          description: 'The PC’s own value, handed back with the ticket.',
        },
      ],
      responses: {
        '302': { description: 'To Google' },
        '400': error('returnUrl not allowed, or no nonce'),
        '503': error('Google sign-in is not configured'),
      },
    },
  },
  '/sync/owner/callback': {
    get: {
      summary: 'Google’s answer',
      description:
        'Exchanges the code, reads the account’s verified id (sub) and email, and redirects to the returnUrl with `nonce`, `ticket` (cho_…, signed, valid one hour) and `expiresAt`, or with `error`.',
      responses: {
        '302': { description: 'Back to the church PC' },
        '400': error('Invalid or expired sign-in'),
      },
    },
  },
  '/sync/owner/churches': {
    get: {
      summary: 'The account’s church servers',
      description:
        'The churches the signed-in account owns, and those offered to it by a transfer (role pending).',
      security: [{ ownerTicket: [] }],
      responses: {
        '200': ok('Its churches', {
          email: { type: 'string' },
          churches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                churchId: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string', enum: ['owner', 'pending'] },
                createdAt: { type: 'integer' },
                updatedAt: { type: 'integer' },
                serverLastSeenAt: { type: ['integer', 'null'] },
                deviceCount: { type: 'integer' },
              },
            },
          },
        }),
        '401': ownerErrors['401'],
      },
    },
  },
  '/sync/owner/churches/{churchId}/recover': {
    post: {
      summary: 'Recover the church on this PC',
      description:
        'Revokes the old church server token and issues one to the calling installation, with the current read path.',
      security: [{ ownerTicket: [] }],
      parameters: [churchId, ...installationHeaders],
      responses: { '200': credentials, ...ownerErrors },
    },
  },
  '/sync/owner/churches/{churchId}/reset': {
    post: {
      summary: 'Revoke every device and rotate the path',
      description:
        'Revokes every device (the server’s old token too), issues the calling installation a fresh server token and moves the church to a new path secret.',
      security: [{ ownerTicket: [] }],
      parameters: [churchId, ...installationHeaders],
      responses: { '200': credentials, ...ownerErrors },
    },
  },
  '/sync/owner/churches/{churchId}/transfer': {
    post: {
      summary: 'Offer the church to another Google account',
      description:
        'It stays the owner’s until that account accepts. A new offer replaces the previous one.',
      security: [{ ownerTicket: [] }],
      parameters: [churchId],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { email: { type: 'string' } },
              required: ['email'],
            },
          },
        },
      },
      responses: {
        '200': ok('Offered', { pendingOwnerEmail: { type: 'string' } }),
        '400': error('No valid email, or it is the owner’s'),
        ...ownerErrors,
      },
    },
  },
  '/sync/owner/churches/{churchId}/accept': {
    post: {
      summary: 'Accept a church offered to you',
      security: [{ ownerTicket: [] }],
      parameters: [churchId],
      responses: {
        '200': ok('You own it', { email: { type: 'string' } }),
        '401': ownerErrors['401'],
        '403': error('Not offered to this account (not_offered)'),
      },
    },
  },
}

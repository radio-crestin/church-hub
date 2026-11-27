/** An error answer of the cloud sync owner routes. */
const error = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { error: { type: 'string' } } },
    },
  },
})

const json = (description: string, data: Record<string, unknown>) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { data: { type: 'object', properties: data } },
      },
    },
  },
})

const body = (properties: Record<string, unknown>, required: string[]) => ({
  required: true,
  content: {
    'application/json': {
      schema: { type: 'object', properties, required },
    },
  },
})

const churchId = {
  name: 'churchId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
}

const ownerErrors = {
  '401': error('Sign in as the owner first (owner_sign_in_required)'),
  '403': error('Not from localhost, or the account does not own the church'),
  '409': error('not_connected, already_connected or server_in_use'),
  '502': error('The sync service refused or failed'),
}

const ownedChurch = {
  type: 'object',
  properties: {
    churchId: { type: 'string' },
    name: { type: 'string', description: 'The church server’s PC name' },
    role: { type: 'string', enum: ['owner', 'pending'] },
    createdAt: { type: 'integer', description: 'Unix seconds' },
    updatedAt: { type: 'integer', description: 'Unix seconds' },
    serverLastSeenAt: { type: ['integer', 'null'] },
    deviceCount: { type: 'integer' },
  },
}

/**
 * Cloud sync's owner on this PC (T-172): Google sign-in through the sync
 * service, and what the owner does with it. Every route is localhost only.
 */
export const syncOwnerPaths: Record<string, Record<string, unknown>> = {
  '/api/sync/cloud/owner/sign-in': {
    post: {
      tags: ['Sync'],
      summary: 'Start the owner’s Google sign-in',
      description:
        'Returns the sync service’s sign-in URL to open in the browser. A nonce only this PC knows rides along; the sign-in returns to /api/sync/cloud/owner/callback with a one-hour owner ticket, kept in memory (never in the database or backups). `connect` then turns cloud sync on owned by that account, `claim` makes this guest church theirs, `manage` and `curate` (the Church Hub Library’s curators, T-177) only sign in.',
      requestBody: body(
        {
          intent: {
            type: 'string',
            enum: ['connect', 'claim', 'manage', 'curate'],
          },
          serviceUrl: {
            type: 'string',
            description: 'A self-hosted sync service, for `connect`.',
          },
        },
        ['intent'],
      ),
      responses: {
        '200': json('The URL to open', { authUrl: { type: 'string' } }),
        '400': error('No valid intent'),
        '403': error('Not from localhost'),
      },
    },
  },
  '/api/sync/cloud/owner/callback': {
    get: {
      tags: ['Sync'],
      summary: 'Owner sign-in return (browser)',
      description:
        'Where the sync service sends the browser back. Refused unless the nonce is one this PC issued in the last 10 minutes; then keeps the owner session and does what the sign-in was for. Answers a small HTML page.',
      parameters: ['nonce', 'ticket', 'expiresAt', 'error'].map((name) => ({
        name,
        in: 'query',
        schema: { type: 'string' },
      })),
      responses: {
        '200': {
          description: 'A page saying whether the sign-in worked',
          content: { 'text/html': { schema: { type: 'string' } } },
        },
      },
    },
  },
  '/api/sync/cloud/owner/sign-out': {
    post: {
      tags: ['Sync'],
      summary: 'Forget the owner session',
      responses: {
        '200': json('Signed out', { signedOut: { type: 'boolean' } }),
        '403': error('Not from localhost'),
      },
    },
  },
  '/api/sync/cloud/owner/churches': {
    get: {
      tags: ['Sync'],
      summary: 'The owner’s church servers',
      description:
        'The churches the signed-in account owns, and those offered to it by a transfer (`pending`).',
      responses: {
        '200': json('Their churches', {
          email: { type: 'string' },
          churches: { type: 'array', items: ownedChurch },
        }),
        ...ownerErrors,
      },
    },
  },
  '/api/sync/cloud/owner/churches/{churchId}/recover': {
    post: {
      tags: ['Sync'],
      summary: 'Recover a church on this PC',
      description:
        'This PC becomes the church’s server: the old server token is revoked and a fresh one issued with the current read path; cloud sync turns on and the library comes down on the first cycle.',
      parameters: [churchId],
      responses: {
        '200': json('Recovered', { churchId: { type: 'string' } }),
        ...ownerErrors,
      },
    },
  },
  '/api/sync/cloud/owner/churches/{churchId}/transfer': {
    post: {
      tags: ['Sync'],
      summary: 'Offer the church to another Google account',
      description:
        'The church stays the owner’s until that account signs in and accepts it.',
      parameters: [churchId],
      requestBody: body({ email: { type: 'string' } }, ['email']),
      responses: {
        '200': json('Offered', { pendingOwnerEmail: { type: 'string' } }),
        '400': error('invalid_email'),
        ...ownerErrors,
      },
    },
  },
  '/api/sync/cloud/owner/churches/{churchId}/accept': {
    post: {
      tags: ['Sync'],
      summary: 'Accept a church offered to you',
      parameters: [churchId],
      responses: {
        '200': json('You own it', { email: { type: 'string' } }),
        ...ownerErrors,
      },
    },
  },
  '/api/sync/cloud/owner/reset': {
    post: {
      tags: ['Sync'],
      summary: 'Revoke every device',
      description:
        'Revokes every device of this PC’s church, its own old server token included, issues this PC a fresh one and moves the church to a new read path: phones are paired again, and a copied backup file opens nothing.',
      responses: {
        '200': json('Revoked; the new read path', {
          readUrl: { type: 'string' },
        }),
        ...ownerErrors,
      },
    },
  },
  '/api/sync/cloud/keep': {
    post: {
      tags: ['Sync'],
      summary: 'Pick which PC keeps the church',
      description:
        'After another PC turned up with this church’s server token (a backup restored there; status cloud.serverConflict): `here: true` takes the church over and syncs on (the other PC is refused from its next call), `false` disconnects this PC.',
      requestBody: body({ here: { type: 'boolean' } }, ['here']),
      responses: {
        '200': json('Done', { kept: { type: 'boolean' } }),
        '400': error('here must be a boolean'),
        ...ownerErrors,
      },
    },
  },
}

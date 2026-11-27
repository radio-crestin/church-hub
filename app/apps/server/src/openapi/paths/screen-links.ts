const link = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    screenId: { type: 'integer', description: 'The screen the link shows' },
    createdAt: { type: 'integer', description: 'Epoch ms' },
    expiresAt: {
      type: 'integer',
      description:
        'Epoch ms; past it the link is refused (a day after it was made)',
    },
  },
}

const json = (description: string, schema: object) => ({
  description,
  content: { 'application/json': { schema } },
})

const errorResponse = (description: string) =>
  json(description, {
    type: 'object',
    properties: { error: { type: 'string' } },
  })

const security = [{ bearerAuth: [] }, { cookieAuth: [] }]

export const screenLinkPaths = {
  '/api/screen-links': {
    post: {
      tags: ['Screen Links'],
      summary: 'Make a screen link',
      description:
        'A link another device (a TV, a laptop) shows this screen through, over WebRTC: the web app on a phone hosts it when the church PC is off. Its token is answered once; only its SHA-256 is kept, in a synced setting, so the PC honours it when it is back. The token signs in with the read permissions a screen needs (not users or logs) and expires after a day. Needs control_room.control.',
      security,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['screenId'],
              properties: { screenId: { type: 'integer' } },
            },
          },
        },
      },
      responses: {
        '201': json('The link, with its token', {
          type: 'object',
          properties: {
            data: {
              ...link,
              properties: {
                ...link.properties,
                token: {
                  type: 'string',
                  description:
                    'Sent as X-User-Auth by the device that opens the link',
                },
              },
            },
          },
        }),
        '400': errorResponse('screenId missing or not an integer'),
        '403': errorResponse('Missing control_room.control'),
      },
    },
    get: {
      tags: ['Screen Links'],
      summary: 'List the standing screen links',
      description:
        'Links not revoked nor expired, without their tokens. Needs control_room.control.',
      security,
      responses: {
        '200': json('The links', {
          type: 'object',
          properties: { data: { type: 'array', items: link } },
        }),
        '403': errorResponse('Missing control_room.control'),
      },
    },
    delete: {
      tags: ['Screen Links'],
      summary: 'Revoke every screen link',
      description:
        'Every device showing a screen through a link is refused from now on. Needs control_room.control.',
      security,
      responses: {
        '200': json('Revoked', {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: { revoked: { type: 'boolean' } },
            },
          },
        }),
        '403': errorResponse('Missing control_room.control'),
      },
    },
  },
  '/api/screen-links/{id}': {
    delete: {
      tags: ['Screen Links'],
      summary: 'Revoke a screen link',
      description:
        'The device showing a screen through it is refused from now on. Needs control_room.control.',
      security,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': json('Revoked', {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: { revoked: { type: 'boolean' } },
            },
          },
        }),
        '403': errorResponse('Missing control_room.control'),
        '404': errorResponse('No such link'),
      },
    },
  },
  '/api/screen-links/endpoints': {
    get: {
      tags: ['Screen Links'],
      summary: 'Where devices reach this PC by a screen link',
      description:
        "The church PC only (the web app's own server answers 503). `internet`: the public web app, the signaling relay and this PC's remote access room, for a link that connects over WebRTC (null while remote access is off). `network`: this PC's LAN addresses and port, for a link opened directly on the church network. Needs control_room.control.",
      security,
      responses: {
        '200': json('The endpoints', {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                internet: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    publicAppUrl: { type: 'string' },
                    relay: { type: 'string' },
                    room: { type: 'string' },
                  },
                },
                network: {
                  type: 'object',
                  properties: {
                    addresses: { type: 'array', items: { type: 'string' } },
                    port: { type: 'integer' },
                  },
                },
              },
            },
          },
        }),
        '403': errorResponse('Missing control_room.control'),
        '503': errorResponse('Not the church PC (the web app’s own server)'),
      },
    },
  },
  '/api/screen-links/sign-in': {
    post: {
      tags: ['Screen Links'],
      summary: 'Sign in with a direct screen link',
      description:
        'A browser on the church network that opened a direct screen link (/screen/<id>#g=<token>) trades its token for the `user_auth` cookie, which lasts as long as the link. A revoked or expired link answers 401.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token'],
              properties: { token: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        '200': json('Signed in: the link, its token set as the cookie', {
          type: 'object',
          properties: { data: link },
        }),
        '401': errorResponse('Not a standing screen link'),
      },
    },
  },
  '/api/screen-links/session': {
    get: {
      tags: ['Screen Links'],
      summary: 'The screen link the caller signed in with',
      description:
        'A device that opened a screen link checks it still stands (its X-User-Auth is the link token); 401 when revoked, expired, or not signed in with a link.',
      security: [{ userAuthHeader: [] }],
      responses: {
        '200': json('The link', { type: 'object', properties: { data: link } }),
        '401': errorResponse('Not a standing screen link'),
      },
    },
  },
}

const settingsResponse = {
  description: 'Remote access settings',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                description:
                  'Whether paired phones reach this computer from anywhere over WebRTC',
              },
              secret: {
                type: 'string',
                description:
                  "The signaling room phones look for this computer in (carried in the pairing QR code's #remote= fragment)",
              },
              relay: {
                type: 'string',
                description:
                  "The signaling relay the room is on (the QR code's &relay=)",
              },
            },
          },
        },
      },
    },
  },
}

const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { error: { type: 'string' } } },
    },
  },
})

export const remoteAccessPaths = {
  '/api/remote-access': {
    get: {
      tags: ['Remote Access'],
      summary: 'Get remote access settings',
      description:
        'Whether remote access is on, and the room secret the pairing QR code carries. Needs users.view.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': settingsResponse,
        '403': errorResponse('Missing users.view'),
      },
    },
    put: {
      tags: ['Remote Access'],
      summary: 'Turn remote access on or off',
      description:
        "On: this computer keeps a room open on the church's signaling relay and answers paired phones' WebRTC offers; their requests reach the server as from a device elsewhere, never as this machine. Needs users.edit.",
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['enabled'],
              properties: { enabled: { type: 'boolean' } },
            },
          },
        },
      },
      responses: {
        '200': settingsResponse,
        '400': errorResponse('enabled is not a boolean'),
        '403': errorResponse('Missing users.edit'),
      },
    },
  },
  '/api/remote-access/reset': {
    post: {
      tags: ['Remote Access'],
      summary: 'Change the remote access room',
      description:
        'A new room secret: phones paired before must scan the code again to connect from away. Needs users.edit.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        '200': settingsResponse,
        '403': errorResponse('Missing users.edit'),
      },
    },
  },
}

/**
 * Where this computer keeps the key that seals saved passwords, API keys
 * and tokens (docs/secrets-at-rest.md).
 */
const security = [{ bearerAuth: [] }, { cookieAuth: [] }]
const tags = ['Secret Store']

const features = {
  type: 'array',
  description:
    'What a restore from another computer left to set up again: its secrets were sealed there and can’t be opened here',
  items: {
    type: 'string',
    enum: [
      'youtube',
      'google-drive',
      'cloud-sync',
      'listener-link',
      'remote-access',
      'cloud-backup',
      'obs',
      'song-sources',
      'ai-search',
      'live-translation',
      'users',
    ],
  },
}

export const secretStorePaths = {
  '/api/secret-store': {
    get: {
      tags,
      summary: 'Where the data key is kept',
      description: 'Needs settings.view.',
      security,
      responses: {
        '200': {
          description: 'The status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      keptIn: {
                        type: 'string',
                        nullable: true,
                        enum: [
                          'keychain',
                          'credential-manager',
                          'secret-service',
                          'file',
                        ],
                        description:
                          'The OS secret store, or `file` (secret-key.json in the data folder, readable by this user only) when the computer has none; null while locked',
                      },
                      locked: {
                        type: 'boolean',
                        description:
                          'The key is in the OS secret store but could not be opened at start: saved secrets read as missing and saving one fails until a restart with it unlocked',
                      },
                      resetFeatures: features,
                    },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/secret-store/reset-features': {
    delete: {
      tags,
      summary: 'Dismiss the "set up again after a restore" notice',
      description: 'Needs settings.edit.',
      security,
      responses: {
        '200': { description: 'Dismissed' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
}

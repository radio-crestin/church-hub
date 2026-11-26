const localhostError = {
  description: 'Only accessible from localhost',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
}

/** An error answer of the cloud sync routes. */
const cloudError = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { error: { type: 'string' } } },
    },
  },
})

const syncConfigSchema = {
  type: 'object',
  properties: {
    syncEnabled: { type: 'boolean' },
    pollIntervalMinutes: {
      type: 'integer',
      description: 'How often to poll Drive for remote changes (1-120).',
    },
    lastSyncAt: { type: ['integer', 'null'], description: 'Unix ms' },
    lastError: { type: ['string', 'null'] },
    transport: {
      type: 'string',
      enum: ['drive', 'cloud'],
      description: 'Cloud: the sync service. Drive: the backup option.',
    },
  },
}

const syncUpdateEntrySchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    entityType: {
      type: 'string',
      enum: ['song', 'song_category', 'song_group', 'schedule'],
    },
    entityUuid: { type: 'string' },
    localId: {
      type: ['integer', 'null'],
      description: 'Local row id after apply (null when removed).',
    },
    changeKind: {
      type: 'string',
      enum: ['added', 'updated', 'removed', 'conflict'],
    },
    title: { type: 'string' },
    sourceDevice: {
      type: ['string', 'null'],
      description: 'Name of the device the change was made on, when known.',
    },
    occurredAt: { type: 'integer', description: 'Unix seconds' },
    seen: { type: 'boolean' },
  },
}

const pendingChangeEntrySchema = {
  type: 'object',
  properties: {
    entityType: {
      type: 'string',
      enum: ['song', 'song_category', 'song_group', 'schedule'],
    },
    entityUuid: { type: 'string' },
    localId: { type: ['integer', 'null'] },
    title: { type: 'string' },
    queuedAt: { type: 'integer', description: 'Unix seconds' },
  },
}

export const syncPaths: Record<string, Record<string, unknown>> = {
  '/api/sync/status': {
    get: {
      tags: ['Sync'],
      summary: 'Get library sync status',
      description:
        'Aggregated state for the sync settings UI and indicator: whether sync is enabled, Drive connection, last sync time/error, local changes waiting to upload and unreviewed changes applied from other devices. Only accessible from localhost.',
      responses: {
        '200': {
          description: 'Sync status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      transport: { type: 'string', enum: ['drive', 'cloud'] },
                      connected: {
                        type: 'boolean',
                        description:
                          'Cloud: a church on the sync service. Drive: a connected Google account.',
                      },
                      cloud: {
                        type: ['object', 'null'],
                        properties: {
                          churchId: { type: 'string' },
                          serviceUrl: { type: 'string' },
                          seq: {
                            type: 'integer',
                            description: 'Last segment applied here.',
                          },
                          ownerEmail: {
                            type: ['string', 'null'],
                            description:
                              'The Google account owning the church; null for a guest church.',
                          },
                          serverConflict: {
                            type: ['object', 'null'],
                            description:
                              'Another PC holds this church’s token (a restored backup): POST /api/sync/cloud/keep picks one.',
                            properties: {
                              otherPcName: { type: ['string', 'null'] },
                              otherPcLastSeenAt: { type: ['integer', 'null'] },
                            },
                          },
                        },
                      },
                      ownerSession: {
                        type: ['object', 'null'],
                        description:
                          'The owner signed in on this PC (an hour, in memory).',
                        properties: {
                          email: { type: 'string' },
                          expiresAt: { type: 'integer' },
                        },
                      },
                      accountEmail: { type: ['string', 'null'] },
                      pollIntervalMinutes: { type: 'integer' },
                      lastSyncAt: { type: ['integer', 'null'] },
                      lastError: { type: ['string', 'null'] },
                      pendingCount: { type: 'integer' },
                      unseenUpdatesCount: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        '403': localhostError,
      },
    },
  },
  '/api/sync/config': {
    get: {
      tags: ['Sync'],
      summary: 'Get library sync settings',
      responses: {
        '200': {
          description: 'Current sync configuration',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { data: syncConfigSchema },
              },
            },
          },
        },
        '403': localhostError,
      },
    },
    put: {
      tags: ['Sync'],
      summary: 'Update library sync settings',
      description:
        'Enables/disables real-time library sync via Google Drive and adjusts the polling interval. Enabling sync immediately starts a first sync cycle in the background. Only accessible from localhost.',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                syncEnabled: { type: 'boolean' },
                pollIntervalMinutes: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 120,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated sync configuration',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { data: syncConfigSchema },
              },
            },
          },
        },
        '403': localhostError,
      },
    },
  },
  '/api/sync/now': {
    post: {
      tags: ['Sync'],
      summary: 'Run a sync cycle now',
      description:
        'Downloads the shared library file from Google Drive, merges it with the local library (last-writer-wins per song/schedule), applies remote changes locally and uploads the merged result. Only accessible from localhost.',
      responses: {
        '200': {
          description: 'Sync cycle result',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      skipped: {
                        type: 'string',
                        enum: ['disabled', 'not_connected', 'no_changes'],
                      },
                      applied: {
                        type: 'integer',
                        description: 'Remote changes applied locally.',
                      },
                      pushed: {
                        type: 'boolean',
                        description:
                          'True when a new library version was uploaded.',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '400': {
          description: 'Sync failed (disabled, not connected, or Drive error)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { error: { type: 'string' } },
              },
            },
          },
        },
        '403': localhostError,
      },
    },
  },
  '/api/sync/pending': {
    get: {
      tags: ['Sync'],
      summary: 'List local changes waiting to upload',
      description:
        'Local edits queued for the next sync cycle (the "to send from this computer" half of the sync changes list), newest first. Deletions are not listed. Only accessible from localhost.',
      responses: {
        '200': {
          description: 'Pending local changes',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      pending: {
                        type: 'array',
                        items: pendingChangeEntrySchema,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '403': localhostError,
      },
    },
  },
  '/api/sync/updates': {
    get: {
      tags: ['Sync'],
      summary: 'List changes applied from other devices',
      description:
        'Feed of library changes synced in from other devices (added / updated / removed / conflict), newest first. Powers the "new version" badges on songs and schedules. Only accessible from localhost.',
      parameters: [
        {
          name: 'unseenOnly',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'Return only entries the user has not reviewed yet.',
        },
      ],
      responses: {
        '200': {
          description: 'Update entries',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      updates: {
                        type: 'array',
                        items: syncUpdateEntrySchema,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '403': localhostError,
      },
    },
  },
  '/api/sync/updates/seen': {
    post: {
      tags: ['Sync'],
      summary: 'Mark sync updates as reviewed',
      description:
        'Marks update entries as seen — all of them when no ids are given. Only accessible from localhost.',
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'integer' } },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Number of entries marked seen',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: { markedSeen: { type: 'integer' } },
                  },
                },
              },
            },
          },
        },
        '403': localhostError,
      },
    },
  },
  '/api/sync/cloud': {
    post: {
      tags: ['Sync'],
      summary: 'Connect to cloud sync',
      description:
        'Registers this server on the cloud sync service as a guest church (to own it, sign in with intent `connect` instead: /api/sync/cloud/owner/sign-in) (churchhub-backend /sync/churches, or CHURCH_HUB_SYNC_URL), keeps its identity, queues the whole library for the first upload, makes cloud the sync transport and starts a first cycle in the background. Google Drive stays available as the backup option. Only accessible from localhost.',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                serviceUrl: {
                  type: 'string',
                  description:
                    'A self-hosted sync service; default: the Church Hub one.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Connected',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      churchId: { type: 'string' },
                      readUrl: {
                        type: 'string',
                        description:
                          'Public, unlisted bucket path the library is read from.',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '403': localhostError,
        '409': cloudError('Already connected'),
        '502': cloudError('The sync service refused or failed'),
      },
    },
    delete: {
      tags: ['Sync'],
      summary: 'Disconnect from cloud sync',
      description:
        'Forgets the church and the central versions, and goes back to the Drive transport, disabled. The church stays on the service. Only accessible from localhost.',
      responses: {
        '200': {
          description: 'Disconnected',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      connected: { type: 'boolean', const: false },
                    },
                  },
                },
              },
            },
          },
        },
        '403': localhostError,
      },
    },
  },
  '/api/sync/cloud/devices': {
    get: {
      tags: ['Sync'],
      summary: 'List cloud sync devices',
      description:
        'The church’s devices on the sync service, newest first, revoked ones included (never their tokens). Requires users.edit.',
      responses: {
        '200': {
          description: 'The devices',
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
                        id: { type: 'string' },
                        name: { type: 'string' },
                        userId: { type: 'integer', nullable: true },
                        isServer: { type: 'boolean' },
                        createdAt: { type: 'integer' },
                        revokedAt: { type: 'integer', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '403': cloudError('Requires users.edit'),
        '409': cloudError('Not connected to cloud sync'),
        '502': cloudError('The sync service refused or failed'),
      },
    },
    post: {
      tags: ['Sync'],
      summary: 'Add a cloud sync device',
      description:
        'Mints a device token on the sync service for one of this server’s users: the device reads the church path and writes with that user’s permissions (the join link of T-168 carries it). The roles and users are mirrored to the service first. Requires users.edit.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                userId: { type: 'integer' },
                name: { type: 'string' },
              },
              required: ['userId', 'name'],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'The device and its token (shown once)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      deviceId: { type: 'string' },
                      token: { type: 'string' },
                      churchId: { type: 'string' },
                      readUrl: { type: 'string' },
                      joinUrl: {
                        type: 'string',
                        description:
                          'The link the device opens to join: <public app>/join#c=<churchId>-<pathSecret>&t=<token>[&p=<remote access room>]&s=<sync service> (CHURCH_HUB_PUBLIC_APP_URL; `s` always, since a link without it reads as the legacy backend)',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '400': cloudError('userId and name are required'),
        '403': cloudError('Requires users.edit'),
        '409': cloudError('Not connected to cloud sync'),
        '502': cloudError('The sync service refused or failed'),
      },
    },
  },
  '/api/sync/cloud/devices/{deviceId}': {
    delete: {
      tags: ['Sync'],
      summary: 'Revoke a cloud sync device',
      description:
        'The service refuses the device’s writes from now on and moves the church to a new secret read path, which this server keeps at once. Requires users.edit.',
      parameters: [
        {
          name: 'deviceId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'Revoked; the new read path',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: { readUrl: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
        '403': cloudError('Requires users.edit'),
        '409': cloudError('Not connected to cloud sync'),
        '502': cloudError('The sync service refused or failed'),
      },
    },
  },
}

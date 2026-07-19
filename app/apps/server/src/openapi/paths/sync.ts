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
                      connected: { type: 'boolean' },
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
}

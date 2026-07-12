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

const backupOperationError = {
  description: 'Operation failed (e.g. not connected, or Drive scope missing)',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          requiresReconnect: {
            type: 'boolean',
            description:
              'True when the connected Google account lacks the drive.appdata scope and must reconnect.',
          },
        },
      },
    },
  },
}

export const backupPaths: Record<string, Record<string, unknown>> = {
  '/api/backup/google/connect': {
    get: {
      tags: ['Backup'],
      summary: 'Start the Google Drive connect flow',
      description:
        "Returns the ChurchHub OAuth worker's /auth/drive URL for the app to open in a browser. The worker holds the Google client credentials (PKCE against Google happens there) and redirects back to /api/backup/google/callback with the tokens. Only accessible from localhost.",
      responses: {
        '200': {
          description: 'Authorization URL (on the OAuth worker)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: { authUrl: { type: 'string' } },
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
  '/api/backup/google/callback': {
    get: {
      tags: ['Backup'],
      summary: 'Google Drive OAuth callback (from the OAuth worker)',
      description:
        'The redirect target the ChurchHub OAuth worker returns to after Google authorization. Persists the tokens and returns a small HTML page. Not called directly by clients.',
      parameters: [
        { name: 'accessToken', in: 'query', schema: { type: 'string' } },
        { name: 'refreshToken', in: 'query', schema: { type: 'string' } },
        {
          name: 'expiresAt',
          in: 'query',
          schema: { type: 'integer' },
          description: 'Access-token expiry (ms epoch)',
        },
        { name: 'email', in: 'query', schema: { type: 'string' } },
        { name: 'error', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'HTML result page',
          content: { 'text/html': {} },
        },
      },
    },
  },
  '/api/backup/google/disconnect': {
    post: {
      tags: ['Backup'],
      summary: 'Disconnect Google Drive',
      description: 'Removes the stored Drive connection. Only from localhost.',
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
                    properties: { success: { type: 'boolean' } },
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
  '/api/backup/status': {
    get: {
      tags: ['Backup'],
      summary: 'Get backup / Google Drive connection status',
      description:
        'Returns whether a Google account is connected, whether the Drive backup scope is granted, and the automatic-backup settings. Only accessible from localhost.',
      responses: {
        '200': {
          description: 'Backup status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      configured: { type: 'boolean' },
                      connected: { type: 'boolean' },
                      driveReady: { type: 'boolean' },
                      requiresReconnect: { type: 'boolean' },
                      email: { type: 'string', nullable: true },
                      autoBackupEnabled: { type: 'boolean' },
                      intervalHours: { type: 'integer' },
                      lastBackupAt: { type: 'integer', nullable: true },
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
  '/api/backup/list': {
    get: {
      tags: ['Backup'],
      summary: 'List backups stored in Google Drive',
      description:
        "Lists the app's backups in the user's private Google Drive app-data folder, newest first. Only accessible from localhost.",
      responses: {
        '200': {
          description: 'List of backups',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      backups: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            sizeBytes: { type: 'integer' },
                            createdAtMs: { type: 'integer' },
                            appVersion: { type: 'string' },
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
        '400': backupOperationError,
        '403': localhostError,
      },
    },
  },
  '/api/backup/now': {
    post: {
      tags: ['Backup'],
      summary: 'Create a backup now',
      description:
        'Checkpoints the database and uploads a fresh backup to Google Drive, then prunes old backups. Only accessible from localhost.',
      responses: {
        '200': {
          description: 'Backup uploaded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      fileId: { type: 'string' },
                      fileName: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        '400': backupOperationError,
        '403': localhostError,
      },
    },
  },
  '/api/backup/restore': {
    post: {
      tags: ['Backup'],
      summary: 'Restore a backup from Google Drive',
      description:
        'Downloads the specified backup and replaces the current database with it (a safety copy of the current database is made first). Only accessible from localhost.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['fileId'],
              properties: {
                fileId: {
                  type: 'string',
                  description: 'Google Drive file id of the backup to restore',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Backup restored',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      requiresRestart: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        '400': backupOperationError,
        '403': localhostError,
      },
    },
  },
  '/api/backup/delete': {
    post: {
      tags: ['Backup'],
      summary: 'Delete a backup from Google Drive',
      description:
        'Permanently deletes a single backup from the app-data folder. Only accessible from localhost.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['fileId'],
              properties: {
                fileId: {
                  type: 'string',
                  description: 'Google Drive file id of the backup to delete',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Backup deleted',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: { success: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
        '400': backupOperationError,
        '403': localhostError,
      },
    },
  },
  '/api/backup/config': {
    get: {
      tags: ['Backup'],
      summary: 'Get automatic-backup settings',
      description: 'Only accessible from localhost.',
      responses: {
        '200': {
          description: 'Backup configuration',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      autoBackupEnabled: { type: 'boolean' },
                      intervalHours: { type: 'integer' },
                      lastBackupAt: { type: 'integer', nullable: true },
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
    put: {
      tags: ['Backup'],
      summary: 'Update automatic-backup settings',
      description:
        'Enables/disables automatic backups and sets the interval (hours). Only accessible from localhost.',
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                autoBackupEnabled: { type: 'boolean' },
                intervalHours: {
                  type: 'integer',
                  minimum: 1,
                  description: 'Hours between automatic backups',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated backup configuration',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      autoBackupEnabled: { type: 'boolean' },
                      intervalHours: { type: 'integer' },
                      lastBackupAt: { type: 'integer', nullable: true },
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
}

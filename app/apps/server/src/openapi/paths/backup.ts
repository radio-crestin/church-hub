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
                      maxBackups: { type: 'integer' },
                      lastBackupAt: { type: 'integer', nullable: true },
                      localBackupPath: { type: 'string', nullable: true },
                      lastLocalBackupAt: { type: 'integer', nullable: true },
                      storage: {
                        type: 'object',
                        nullable: true,
                        description:
                          'Drive storage quota vs. current database size; null when Drive is unreachable.',
                        properties: {
                          limitBytes: {
                            type: 'integer',
                            nullable: true,
                            description:
                              'Total Drive quota; null for unlimited accounts.',
                          },
                          usageBytes: { type: 'integer' },
                          availableBytes: {
                            type: 'integer',
                            nullable: true,
                          },
                          dbSizeBytes: {
                            type: 'integer',
                            description:
                              'Current database size — the approximate size of the next backup.',
                          },
                          insufficientSpace: {
                            type: 'boolean',
                            description:
                              'True when the free Drive space cannot fit another backup.',
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
        'Checkpoints the database and uploads a fresh backup to Google Drive, then prunes backups beyond the configured `maxBackups`. Fails with `insufficient_drive_space` when the Drive quota cannot fit the backup. Only accessible from localhost.',
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
  '/api/backup/inspect': {
    post: {
      tags: ['Backup'],
      summary: "Inspect a backup's contents",
      description:
        'Downloads the specified backup and reads its contents (song titles, schedules, playlists and per-table counts) without restoring it. Only accessible from localhost.',
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
                  description: 'Google Drive file id of the backup to inspect',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Backup contents',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      counts: {
                        type: 'object',
                        properties: {
                          songs: { type: 'integer' },
                          songSlides: { type: 'integer' },
                          songCategories: { type: 'integer' },
                          songBookmarks: { type: 'integer' },
                          schedules: { type: 'integer' },
                          scheduleItems: { type: 'integer' },
                          musicPlaylists: { type: 'integer' },
                          musicFiles: { type: 'integer' },
                          bibleTranslations: { type: 'integer' },
                          users: { type: 'integer' },
                          screens: { type: 'integer' },
                        },
                      },
                      songs: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            category: { type: 'string', nullable: true },
                          },
                        },
                      },
                      schedules: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            createdAtMs: { type: 'integer', nullable: true },
                            itemCount: {
                              type: 'integer',
                              description:
                                'Total items in the program (songs, passages, slides, scenes)',
                            },
                            songCount: {
                              type: 'integer',
                              description: 'Song items only',
                            },
                            songTitles: {
                              type: 'array',
                              items: { type: 'string' },
                              description:
                                'First song titles, in program order (capped)',
                            },
                          },
                        },
                      },
                      playlists: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            itemCount: { type: 'integer' },
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
  '/api/backup/local/list': {
    get: {
      tags: ['Backup'],
      summary: 'List local backups',
      description:
        'Lists the backup files present in the configured local folder, newest first. Returns an empty list when local backups are off or the folder is unreachable. Only accessible from localhost.',
      responses: {
        '200': {
          description: 'Local backups',
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
                            name: { type: 'string' },
                            path: { type: 'string' },
                            sizeBytes: { type: 'integer' },
                            createdAtMs: { type: 'integer' },
                            appVersion: { type: 'string', nullable: true },
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
        '403': localhostError,
      },
    },
  },
  '/api/backup/local/now': {
    post: {
      tags: ['Backup'],
      summary: 'Write a backup to the local folder',
      description:
        'Checkpoints the database and copies it into the configured local folder, then prunes older local backups down to the retention setting. Works without a Google account. Only accessible from localhost.',
      responses: {
        '200': {
          description: 'Local backup written',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      fileName: { type: 'string' },
                      path: { type: 'string' },
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
  '/api/backup/local/delete': {
    post: {
      tags: ['Backup'],
      summary: 'Delete a local backup',
      description:
        'Deletes one backup file from the configured local folder. Only accessible from localhost.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['fileName'],
              properties: {
                fileName: {
                  type: 'string',
                  description:
                    'Name of the backup file inside the configured folder',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Local backup deleted',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
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
                      maxBackups: { type: 'integer' },
                      lastBackupAt: { type: 'integer', nullable: true },
                      localBackupPath: { type: 'string', nullable: true },
                      lastLocalBackupAt: { type: 'integer', nullable: true },
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
        'Enables/disables automatic backups, sets the interval (hours) and how many backups to keep in Drive. Only accessible from localhost.',
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
                maxBackups: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 50,
                  description:
                    'Number of most-recent backups kept in Drive; when a new backup exceeds this, the oldest is deleted. Default 5.',
                },
                localBackupPath: {
                  type: 'string',
                  nullable: true,
                  description:
                    'Absolute folder each backup is also written to. Null or an empty string turns local backups off.',
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
                      maxBackups: { type: 'integer' },
                      lastBackupAt: { type: 'integer', nullable: true },
                      localBackupPath: { type: 'string', nullable: true },
                      lastLocalBackupAt: { type: 'integer', nullable: true },
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

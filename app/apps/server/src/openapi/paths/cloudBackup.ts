/** An error answer of the cloud backup routes: a code the app explains. */
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

const body = (properties: Record<string, unknown>) => ({
  content: {
    'application/json': { schema: { type: 'object', properties } },
  },
})

const backupId = {
  name: 'backupId',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{22}$' },
}

const cloudBackup = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    sizeBytes: {
      type: 'integer',
      description: 'As stored (encrypted, gzipped)',
    },
    createdAt: { type: 'integer', description: 'Unix ms' },
    appVersion: { type: 'string' },
    keyVersion: { type: 'integer' },
  },
}

const schedule = {
  autoBackupEnabled: { type: 'boolean' },
  intervalHours: { type: 'integer', enum: [6, 12, 24, 48, 168] },
  lastBackupAt: { type: ['integer', 'null'], description: 'Unix ms' },
}

const signedInErrors = {
  '401': error('Not signed in, or the session ended (cloud_sign_in_required)'),
  '403': error('Not from localhost'),
  '409': error(
    'Another cloud backup or restore is running (busy), or upload_in_progress',
  ),
  '413': error('Over the free tier: too_large or quota_exceeded'),
  '429': error('daily_limit or rate_limited'),
  '502': error('The backup service failed or could not be reached'),
}

/**
 * Church Hub Cloud backup on this PC: free, encrypted backups to the
 * Church Hub backend for a Google account. Every route is localhost only.
 * The refresh token stays in server_secrets; no route returns it.
 */
export const cloudBackupPaths: Record<string, Record<string, unknown>> = {
  '/api/backup/cloud/status': {
    get: {
      tags: ['Backup'],
      summary: 'Church Hub Cloud: sign-in and schedule',
      responses: {
        '200': json('Never a token', {
          signedIn: { type: 'boolean' },
          email: { type: ['string', 'null'] },
          ...schedule,
        }),
        '403': error('Not from localhost'),
      },
    },
  },
  '/api/backup/cloud/sign-in': {
    post: {
      tags: ['Backup'],
      summary: 'Start the Google sign-in',
      description:
        'Returns the backup service’s sign-in URL to open in the browser. A nonce and the hash of a verifier only this PC knows ride along; the sign-in returns to /api/backup/cloud/callback with a grant this server swaps (with the verifier) for a session.',
      responses: {
        '200': json('Open it in the browser', { authUrl: { type: 'string' } }),
        '403': error('Not from localhost'),
      },
    },
  },
  '/api/backup/cloud/callback': {
    get: {
      tags: ['Backup'],
      summary: 'The sign-in’s return (HTML)',
      responses: {
        '200': {
          description:
            'A page saying whether the sign-in worked, in English and Romanian',
          content: { 'text/html': { schema: { type: 'string' } } },
        },
      },
    },
  },
  '/api/backup/cloud/sign-out': {
    post: {
      tags: ['Backup'],
      summary: 'Sign out, optionally deleting every cloud backup',
      description:
        'With `deleteBackups`, the account’s backups and data are deleted on the service first. Either way every token issued so far is refused, this PC forgets its sign-in and automatic cloud backups stop.',
      requestBody: body({ deleteBackups: { type: 'boolean' } }),
      responses: {
        '200': json('Signed out', {
          signedOut: { type: 'boolean' },
          deletedBackups: { type: 'integer' },
        }),
        ...signedInErrors,
      },
    },
  },
  '/api/backup/cloud/config': {
    put: {
      tags: ['Backup'],
      summary: 'Automatic cloud backups',
      requestBody: body({
        autoBackupEnabled: schedule.autoBackupEnabled,
        intervalHours: schedule.intervalHours,
      }),
      responses: {
        '200': json('The schedule', schedule),
        '400': error('invalid_request'),
        '403': error('Not from localhost'),
      },
    },
  },
  '/api/backup/cloud/backups': {
    get: {
      tags: ['Backup'],
      summary: 'The account’s cloud backups and free-tier usage',
      responses: {
        '200': json('Newest first', {
          backups: { type: 'array', items: cloudBackup },
          usage: {
            type: 'object',
            properties: {
              usedBytes: { type: 'integer' },
              quotaBytes: { type: 'integer' },
              maxBackupBytes: { type: 'integer' },
              maxBackups: { type: 'integer' },
              uploadsPerDay: { type: 'integer' },
            },
          },
        }),
        ...signedInErrors,
      },
    },
    post: {
      tags: ['Backup'],
      summary: 'Back up now',
      description:
        'Copies the database, gzips and encrypts it on this PC (AES-256-GCM under a fresh key wrapped with the account key) and uploads it straight to the bucket in parts.',
      responses: {
        '200': json('Uploaded', { backup: cloudBackup }),
        ...signedInErrors,
      },
    },
  },
  '/api/backup/cloud/backups/{backupId}/restore': {
    post: {
      tags: ['Backup'],
      summary: 'Restore a cloud backup',
      description:
        'Downloads, decrypts and checks the backup, then replaces the database (the current one is kept to fall back on). This PC stays signed in as it was.',
      parameters: [backupId],
      responses: {
        '200': json('Restored', { requiresRestart: { type: 'boolean' } }),
        '404': error('No such backup in the account (not_found)'),
        '422': error(
          'The file was changed or the key is wrong (backup_unreadable)',
        ),
        ...signedInErrors,
      },
    },
  },
  '/api/backup/cloud/backups/{backupId}': {
    delete: {
      tags: ['Backup'],
      summary: 'Delete a cloud backup',
      parameters: [backupId],
      responses: {
        '200': json('Deleted', { deleted: { type: 'boolean' } }),
        '404': error('No such backup in the account (not_found)'),
        ...signedInErrors,
      },
    },
  },
}

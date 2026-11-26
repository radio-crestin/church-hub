/**
 * OpenAPI 3.1 document of Church Hub Cloud backup (served at
 * /backup/openapi.json, rendered by Scalar at /backup/docs).
 */
import { MAX_PENDING_UPLOADS } from './account/checkCanStartUpload'
import { UPLOAD_MAX_AGE_MS } from './account/takeExpiredUploads'
import { DEFAULT_LIMITS } from './backupSettings'
import { PRESIGN_TTL_SECONDS } from './storage/createBackupBucket'

const error = (description: string) => ({
  description,
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/Error' } },
  },
})

const json = (description: string, schema: object) => ({
  description,
  content: { 'application/json': { schema } },
})

const body = (properties: Record<string, object>, required: string[]) => ({
  required: true,
  content: {
    'application/json': {
      schema: { type: 'object', properties, required },
    },
  },
})

const backupId = {
  name: 'backupId',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{22}$' },
}

const signedIn = [{ accessToken: [] }]
const unauthorized = error(
  'Missing, forged, expired or revoked access token (code unauthorized)'
)
const notFound = error(
  'No such backup or upload in the caller’s own account (code not_found)'
)
const limited = error('Over the per-IP or per-account rate limit (code rate_limited)')
const notConfigured = error('Cloud backup is not configured (code not_configured)')
const common = { '401': unauthorized, '429': limited, '503': notConfigured }

const session = {
  type: 'object',
  properties: {
    accessToken: { type: 'string', description: 'chba_…, valid one hour' },
    accessExpiresAt: { type: 'integer', description: 'Unix seconds' },
    refreshToken: {
      type: 'string',
      description: 'chbr_…, valid 180 days; each refresh returns a new one',
    },
    refreshExpiresAt: { type: 'integer', description: 'Unix seconds' },
    email: { type: 'string', description: 'The Google account (lowercased)' },
  },
  required: [
    'accessToken',
    'accessExpiresAt',
    'refreshToken',
    'refreshExpiresAt',
    'email',
  ],
}

const MIB = 1024 * 1024

export const backupOpenApi = {
  openapi: '3.1.0',
  info: {
    title: 'Church Hub Cloud backup',
    version: '1.0.0',
    description: [
      'Free cloud backups of a church’s Church Hub database, for a Google account.',
      '',
      '**Sign-in.** The PC opens `/backup/sign-in` with its loopback callback, a nonce and the SHA-256 (base64url) of a verifier it keeps. Google answers `/backup/callback` (PKCE, scopes `openid email`, verified email required), which redirects to the PC with its nonce and a five-minute grant. The PC swaps the grant and its verifier for a session (`POST /backup/session`): an access token (one hour) and a refresh token (180 days). Tokens are HMAC-signed, compared in constant time and bound to the Google `sub` and to the PC’s session family. A refresh token is single use: each refresh moves its family to the next generation, and a token of an older generation (a copy used twice) ends every session of the account. Signing out ends the PC’s family; deleting the account ends them all.',
      '',
      '**What a backup is.** Three kinds of objects in a private, unlisted bucket, under folders named by a keyed hash of the Google `sub` (never its email):',
      '- the **user part**: the church’s own data (settings, users, programs, history, bookmarks, its own and edited songs, every song’s usage), an SQLite file the app gzips and encrypts (AES-256-GCM in 1 MiB chunks under a fresh key, wrapped with the account key from `GET /backup/key`);',
      '- the **manifest**: encrypted the same way; it lists the user part’s hash and the blobs the backup needs;',
      '- **resource blobs**: shared, rarely changing data (Bible translations; the slides of unedited songs from song libraries), plaintext, content-addressed by the SHA-256 of their contents, immutable, under a random per-account prefix. A blob the account already stores is never sent again, so a backup with unchanged resources uploads only its user part and manifest.',
      '',
      `Uploads and downloads go straight to the bucket through presigned URLs valid ${PRESIGN_TTL_SECONDS / 60} minutes, each PUT signed for its exact Content-Length. Restore verifies every blob’s hash and the user part’s hash from the manifest.`,
      '',
      `**Quota.** Each account may store its quota (${DEFAULT_LIMITS.quotaBytes / MIB} MiB by default, \`BACKUP_QUOTA_BYTES\`, or an admin’s override), counting every backup’s user part and manifest plus each blob once. The record keeps the authoritative usage counter and the blobs’ reference counts, changed only by compare-and-swap. An upload reserves what it adds at start; when used + reserved + that would pass the quota it is refused (nothing is deleted to make room). Sizes are read from the bucket at completion; a blob with no backup referring to it is deleted; a daily reconcile recomputes everything from the bucket.`,
      '',
      `**Retention.** A backup expires ${DEFAULT_LIMITS.retentionDays} days after it was made (\`BACKUP_RETENTION_DAYS\`), removed by the hourly upkeep. No other pruning.`,
      '',
      `**Free tier** (defaults): ${DEFAULT_LIMITS.maxBackupBytes / MIB} MiB an upload, ${DEFAULT_LIMITS.uploadsPerDay} uploads a day, ${MAX_PENDING_UPLOADS} in flight (dropped after ${UPLOAD_MAX_AGE_MS / 3600000} hours).`,
    ].join('\n'),
  },
  components: {
    securitySchemes: {
      accessToken: {
        type: 'http',
        scheme: 'bearer',
        description: 'An access token (chba_…) from POST /backup/session or /backup/session/refresh.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: {
            type: 'string',
            enum: [
              'invalid_request',
              'unauthorized',
              'not_found',
              'too_large',
              'quota_exceeded',
              'suspended',
              'daily_limit',
              'upload_in_progress',
              'upload_incomplete',
              'size_mismatch',
              'rate_limited',
              'busy',
              'not_configured',
              'internal',
            ],
          },
        },
        required: ['error', 'code'],
      },
      Backup: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          sizeBytes: { type: 'integer', description: 'Its own bytes: user part + manifest (blobs are shared)' },
          blobCount: { type: 'integer', description: 'Resource blobs it references' },
          createdAt: { type: 'integer', description: 'Unix ms; it expires retentionDays after' },
          appVersion: { type: 'string' },
          keyVersion: { type: 'integer' },
        },
        required: ['id', 'sizeBytes', 'blobCount', 'createdAt', 'appVersion', 'keyVersion'],
      },
    },
  },
  paths: {
    '/backup/sign-in': {
      get: {
        tags: ['Sign-in'],
        summary: 'Start the Google sign-in',
        parameters: [
          {
            name: 'returnUrl',
            in: 'query',
            required: true,
            description: 'The PC’s loopback callback (http://localhost or 127.0.0.1), or an allowed origin',
            schema: { type: 'string' },
          },
          {
            name: 'nonce',
            in: 'query',
            required: true,
            schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{16,128}$' },
          },
          {
            name: 'challenge',
            in: 'query',
            required: true,
            description: 'base64url SHA-256 of the PC’s verifier',
            schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' },
          },
        ],
        responses: {
          '302': { description: 'To Google’s account chooser' },
          '400': error('returnUrl, nonce or challenge refused (invalid_request)'),
          '503': notConfigured,
        },
      },
    },
    '/backup/callback': {
      get: {
        tags: ['Sign-in'],
        summary: 'Google’s answer',
        description:
          'Redirects to the PC’s returnUrl with `nonce` and `grant` (five minutes, bound to the challenge), or `nonce` and `error` (access_denied, missing_code, expired, unverified_account).',
        responses: {
          '302': { description: 'Back to the PC' },
          '400': error('The state is missing or was tampered with'),
        },
      },
    },
    '/backup/session': {
      post: {
        tags: ['Sign-in'],
        summary: 'Swap a grant for a session',
        requestBody: body(
          {
            grant: { type: 'string', description: 'chbg_… from the callback' },
            verifier: { type: 'string', description: 'The verifier the challenge was made from' },
          },
          ['grant', 'verifier']
        ),
        responses: {
          '200': json('The session', session),
          '401': error('Grant forged or expired, or the verifier doesn’t match'),
        },
      },
      delete: {
        tags: ['Sign-in'],
        summary: 'Sign this PC out',
        description: 'Ends the caller’s session family: its access and refresh tokens are refused; the account’s other PCs stay signed in.',
        security: signedIn,
        responses: {
          '200': json('Signed out', { type: 'object', properties: { signedOut: { type: 'boolean' } } }),
          ...common,
        },
      },
    },
    '/backup/session/refresh': {
      post: {
        tags: ['Sign-in'],
        summary: 'A new session for a refresh token',
        requestBody: body({ refreshToken: { type: 'string' } }, ['refreshToken']),
        responses: {
          '200': json('The new session (a new refresh token too)', session),
          '401': error('Refresh token forged, expired, revoked, or used before (which ends every session of the account)'),
        },
      },
    },
    '/backup/usage': {
      get: {
        tags: ['Backups'],
        summary: 'Used, reserved and quota bytes',
        security: signedIn,
        responses: {
          '200': json('The account’s usage', {
            type: 'object',
            properties: {
              usedBytes: { type: 'integer', description: 'Finished backups, real sizes' },
              reservedBytes: { type: 'integer', description: 'Uploads in flight' },
              quotaBytes: { type: 'integer', description: 'The account’s quota' },
              maxBackupBytes: { type: 'integer' },
              retentionDays: { type: 'integer' },
              uploadsPerDay: { type: 'integer' },
              suspended: { type: 'boolean' },
            },
          }),
          ...common,
        },
      },
    },
    '/backup/key': {
      get: {
        tags: ['Backups'],
        summary: 'The account key',
        description:
          'The 256-bit key (base64url) the app wraps each backup’s own key with. The same for the account on every PC, so a reinstall can restore.',
        security: signedIn,
        responses: {
          '200': json('The key', {
            type: 'object',
            properties: { keyVersion: { type: 'integer' }, key: { type: 'string' } },
            required: ['keyVersion', 'key'],
          }),
          ...common,
        },
      },
    },
    '/backup/backups': {
      get: {
        tags: ['Backups'],
        summary: 'The account’s backups and free-tier usage',
        security: signedIn,
        responses: {
          '200': json('Newest first', {
            type: 'object',
            properties: {
              backups: { type: 'array', items: { $ref: '#/components/schemas/Backup' } },
              usage: {
                type: 'object',
                properties: {
                  usedBytes: { type: 'integer' },
                  maxBackupBytes: { type: 'integer' },
                  quotaBytes: { type: 'integer' },
                  retentionDays: { type: 'integer' },
                  uploadsPerDay: { type: 'integer' },
                },
              },
            },
          }),
          ...common,
        },
      },
    },
    '/backup/uploads': {
      post: {
        tags: ['Backups'],
        summary: 'Start an upload',
        description:
          'Declares the encrypted user part and manifest and every resource blob the backup references. Checks the free tier (size, daily uploads, uploads in flight, used + reserved + what this upload adds within the quota), opens a multipart upload for the user part, takes a ref on every blob and reserves the bytes. Answers which blobs to send: the others are already stored.',
        security: signedIn,
        requestBody: body(
          {
            userBytes: { type: 'integer', description: 'The encrypted user part’s exact size' },
            manifestBytes: { type: 'integer', description: 'The encrypted manifest’s exact size (≤ 256 KiB)' },
            blobs: {
              type: 'array',
              maxItems: 200,
              items: {
                type: 'object',
                properties: {
                  hash: { type: 'string', pattern: '^[0-9a-f]{64}$', description: 'SHA-256 of the blob’s contents' },
                  sizeBytes: { type: 'integer', description: 'Its exact size as stored (gzipped)' },
                },
              },
            },
            appVersion: { type: 'string' },
            keyVersion: { type: 'integer', const: 1 },
          },
          ['userBytes', 'manifestBytes', 'blobs', 'keyVersion']
        ),
        responses: {
          '201': json('Started', {
            type: 'object',
            properties: {
              backupId: { type: 'string' },
              partSize: { type: 'integer', description: 'Every part but the last' },
              partCount: { type: 'integer' },
              missingBlobs: { type: 'array', items: { type: 'string' }, description: 'The blobs to send' },
              expiresAt: { type: 'integer', description: 'Unix ms; unfinished, it is dropped' },
            },
          }),
          '400': error('Bad size or key version (invalid_request)'),
          '403': error('An admin paused uploads for this account (suspended)'),
          '409': error('Too many uploads in flight (upload_in_progress)'),
          '413': error('Over the backup size (too_large) or the account’s quota (quota_exceeded, with usedBytes, reservedBytes, neededBytes, quotaBytes)'),
          ...common,
          '429': error('rate_limited, or daily_limit'),
        },
      },
    },
    '/backup/uploads/{backupId}/parts': {
      post: {
        tags: ['Backups'],
        summary: 'Presigned URLs for parts of the user part',
        description: `PUT each part's bytes to its URL (valid ${PRESIGN_TTL_SECONDS / 60} minutes), exactly sizeBytes of them: the URL is signed with that Content-Length and the store refuses any other. Ask for at most 50 at a time, as the upload goes.`,
        security: signedIn,
        parameters: [backupId],
        requestBody: body(
          { partNumbers: { type: 'array', items: { type: 'integer', minimum: 1 }, maxItems: 50 } },
          ['partNumbers']
        ),
        responses: {
          '200': json('The URLs', {
            type: 'object',
            properties: {
              parts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    partNumber: { type: 'integer' },
                    sizeBytes: { type: 'integer', description: 'The exact length signed into the URL' },
                    url: { type: 'string' },
                  },
                },
              },
              expiresAt: { type: 'integer', description: 'Unix ms' },
            },
          }),
          '400': error('Bad part numbers (invalid_request)'),
          '404': notFound,
          ...common,
        },
      },
    },
    '/backup/uploads/{backupId}/files': {
      post: {
        tags: ['Backups'],
        summary: 'Presigned URLs for the manifest and the blobs to send',
        description: `PUT each file to its URL (valid ${PRESIGN_TTL_SECONDS / 60} minutes), exactly sizeBytes of it: the URL is signed with that Content-Length.`,
        security: signedIn,
        parameters: [backupId],
        requestBody: body(
          { files: { type: 'array', maxItems: 50, items: { type: 'string', description: '"manifest", or a blob hash from missingBlobs' } } },
          ['files']
        ),
        responses: {
          '200': json('The URLs', {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { name: { type: 'string' }, sizeBytes: { type: 'integer' }, url: { type: 'string' } },
                },
              },
              expiresAt: { type: 'integer', description: 'Unix ms' },
            },
          }),
          '400': error('Not the manifest or a blob this upload sends (invalid_request)'),
          '404': notFound,
          ...common,
        },
      },
    },
    '/backup/uploads/{backupId}/complete': {
      post: {
        tags: ['Backups'],
        summary: 'Finish an upload',
        description:
          'The manifest and every blob this upload sends must be in the bucket at their declared sizes (missing: 409 with `missing`), and the user part’s parts must add up to its declared size. Sizes are read from the bucket; a wrong one aborts the upload. Then the backup is listed, its new blobs marked stored and the usage grows by what was really added; past the quota the upload is dropped.',
        security: signedIn,
        parameters: [backupId],
        responses: {
          '200': json('Listed', {
            type: 'object',
            properties: { backup: { $ref: '#/components/schemas/Backup' } },
          }),
          '400': error('Not the reserved size: aborted or deleted (size_mismatch)'),
          '413': error('Past the quota: deleted (quota_exceeded)'),
          '404': notFound,
          '409': error('Files or parts missing (upload_incomplete, with missing or uploadedParts)'),
          ...common,
        },
      },
    },
    '/backup/uploads/{backupId}': {
      delete: {
        tags: ['Backups'],
        summary: 'Cancel an upload',
        security: signedIn,
        parameters: [backupId],
        responses: {
          '200': json('Aborted', { type: 'object', properties: { aborted: { type: 'boolean' } } }),
          '404': notFound,
          ...common,
        },
      },
    },
    '/backup/backups/{backupId}/download': {
      post: {
        tags: ['Backups'],
        summary: 'Presigned download URLs: manifest, user part, blobs',
        security: signedIn,
        parameters: [backupId],
        responses: {
          '200': json('GET it within the time', {
            type: 'object',
            properties: {
              manifestUrl: { type: 'string' },
              userPartUrl: { type: 'string' },
              blobs: {
                type: 'array',
                items: { type: 'object', properties: { hash: { type: 'string' }, url: { type: 'string' } } },
              },
              expiresAt: { type: 'integer', description: 'Unix ms' },
              keyVersion: { type: 'integer' },
            },
          }),
          '404': notFound,
          ...common,
        },
      },
    },
    '/backup/backups/{backupId}': {
      delete: {
        tags: ['Backups'],
        summary: 'Delete a backup',
        security: signedIn,
        parameters: [backupId],
        responses: {
          '200': json('Deleted', { type: 'object', properties: { deleted: { type: 'boolean' } } }),
          '404': notFound,
          ...common,
        },
      },
    },
    '/backup/account': {
      delete: {
        tags: ['Backups'],
        summary: 'Delete the account and all its backups',
        description:
          'Deletes every backup, blob and upload in flight and the record, and refuses every token issued so far. What stays is a tombstone keyed by the account hash: the pause, an admin’s quota override, the day’s upload count and date, and when it was deleted (no email, no Google id). A new sign-in with the same account takes those limits back; it is purged 90 days after the deletion.',
        security: signedIn,
        responses: {
          '200': json('Deleted', {
            type: 'object',
            properties: { deletedBackups: { type: 'integer' } },
          }),
          ...common,
        },
      },
    },
  },
}

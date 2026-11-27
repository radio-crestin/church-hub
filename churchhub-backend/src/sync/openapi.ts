/**
 * OpenAPI 3.1 document of the cloud sync service (served at
 * /sync/openapi.json, rendered by Scalar at /sync/docs).
 */
import { libraryOpenApiPaths } from '../library/libraryOpenApi'
import { installationHeaders, ownerOpenApiPaths } from './owner/ownerOpenApi'
import { ENTITY_TYPES } from './types'

const error = (description: string) => ({
  description,
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/Error' } },
  },
})

const churchId = {
  name: 'churchId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
}

const location = {
  type: 'object',
  properties: {
    pathSecret: { type: 'string', description: '256-bit secret, base64url' },
    readUrl: {
      type: 'string',
      description:
        'Public base URL of churches/<churchId>-<pathSecret>; readers GET <readUrl>/head.json, then the snapshot and segments it lists.',
    },
  },
  required: ['pathSecret', 'readUrl'],
}

const unauthorized = error(
  'Missing, invalid or revoked token (code unauthorized)'
)
const forbidden = error('The token’s user lacks users.edit (code forbidden)')
const notConfigured = error('Cloud sync is not configured on this server')

export const syncOpenApi = {
  openapi: '3.1.0',
  info: {
    title: 'Church Hub cloud sync',
    version: '1.0.0',
    description:
      'The one writer of every church’s synced library (docs/design/cloud-sync-and-shared-library.md §3-5). Every write is authenticated by a device token, authorized against the user’s permissions and versioned, then published to an S3-compatible bucket as one segment. Reads never call this service: clients GET the public, unlisted bucket path directly.',
  },
  components: {
    securitySchemes: {
      deviceToken: {
        type: 'http',
        scheme: 'bearer',
        description:
          'A device token (chs_…): the church server’s from registration, or a device’s from POST devices.',
      },
      ownerTicket: {
        type: 'http',
        scheme: 'bearer',
        description:
          'An owner ticket (cho_…) from the Google sign-in (/sync/owner/sign-in), valid one hour.',
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
              'forbidden',
              'conflict',
              'not_found',
              'unknown_user',
              'server_device',
              'too_large',
              'rate_limited',
              'busy',
              'not_configured',
              'internal',
              'server_in_use',
              'already_owned',
              'not_owner',
              'not_offered',
              'owner_unauthorized',
            ],
          },
        },
        required: ['error', 'code'],
      },
      Location: location,
      Change: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...ENTITY_TYPES] },
          uuid: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' },
          op: { type: 'string', enum: ['upsert', 'delete'] },
          baseVersion: {
            type: 'integer',
            minimum: 0,
            description: 'The version the client last saw; 0 for a new row.',
          },
          author: {
            type: ['string', 'null'],
            description:
              'The church server’s only: the user (uuid) who made the change; null: the server itself. A phone’s changes are its own user’s.',
          },
          data: {
            type: 'object',
            description:
              'For upserts: the whole aggregate, in the app’s LibraryFile shape, with the same uuid.',
          },
          deletedAt: {
            type: 'integer',
            description: 'For deletes: unix seconds.',
          },
        },
        required: ['type', 'uuid', 'op', 'baseVersion'],
      },
    },
  },
  paths: {
    '/sync/churches': {
      post: {
        summary: 'Register a church server',
        description:
          'Creates a church with a fresh path secret and an empty head.json, and returns the church server’s token (shown once). With an owner ticket, that Google account owns it; without, it is a guest church (claim it later). Rate limited per IP.',
        parameters: installationHeaders,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'The server’s name' },
                  ownerTicket: {
                    type: 'string',
                    description: 'From the Google sign-in: the owner.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Registered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    churchId: { type: 'string' },
                    ...location.properties,
                    deviceId: { type: 'string' },
                    serverToken: { type: 'string' },
                    ownerEmail: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
          '429': error('Too many registrations from this address'),
          '503': notConfigured,
        },
      },
    },
    '/sync/churches/{churchId}/path': {
      get: {
        summary: 'Where the church is read from now',
        description:
          'Any valid token of the church. Used after a path rotation, when the old head.json is gone, and by the church PC to check in now and then (it learns the owner, and whether another PC holds its token).',
        security: [{ deviceToken: [] }],
        parameters: [churchId, ...installationHeaders],
        responses: {
          '200': {
            description: 'The current read location, and the owner',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ...location.properties,
                    ownerEmail: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '409': error('Another PC holds the server token (server_in_use)'),
        },
      },
    },
    '/sync/churches/{churchId}/device': {
      get: {
        summary: 'The device behind a token',
        description:
          'Any valid token of the church: its device and the user it writes as (null for the church server). The church PC asks it with a phone\'s token before letting the phone in over WebRTC.',
        security: [{ deviceToken: [] }],
        parameters: [churchId],
        responses: {
          '200': {
            description: 'The device and its user',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    deviceId: { type: 'string' },
                    userId: { type: ['string', 'null'] },
                    isServer: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '401': unauthorized,
        },
      },
    },
    '/sync/churches/{churchId}/devices': {
      get: {
        summary: 'List devices',
        description:
          'Every device of the church, newest first, revoked ones included (never their tokens). Needs users.edit.',
        security: [{ deviceToken: [] }],
        parameters: [churchId],
        responses: {
          '200': {
            description: 'The devices',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    devices: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          userId: { type: 'string', nullable: true },
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
          '401': unauthorized,
          '403': forbidden,
        },
      },
      post: {
        summary: 'Add a device',
        description:
          'Mints a token bound to one of the church’s users (from PUT access); the device writes with that user’s permissions. The token is shown once. Needs users.edit.',
        security: [{ deviceToken: [] }],
        parameters: [churchId],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  name: { type: 'string' },
                },
                required: ['userId', 'name'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'The new device and its token',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    deviceId: { type: 'string' },
                    token: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': error(
            'Missing fields, no such user (code unknown_user), or a deactivated one once the church revokes devices with their user (code inactive_user)'
          ),
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/sync/churches/{churchId}/devices/{deviceId}': {
      delete: {
        summary: 'Revoke a device',
        description:
          'Refuses the device’s writes from now on and rotates the path secret in the same write, since it still knows the old read path. The church server itself cannot be revoked. Needs users.edit.',
        security: [{ deviceToken: [] }],
        parameters: [
          churchId,
          {
            name: 'deviceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Revoked; the new read location',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Location' },
                    {
                      type: 'object',
                      properties: { revoked: { type: 'boolean' } },
                    },
                  ],
                },
              },
            },
          },
          '400': error('The church server’s own device (code server_device)'),
          '401': unauthorized,
          '403': forbidden,
          '404': error('No such active device'),
        },
      },
    },
    '/sync/churches/{churchId}/media': {
      post: {
        summary: 'Publish the church’s media',
        description:
          'The church server only: every media file its synced data references (song backgrounds, slides, videos), each time in full and in priority order. Files are content-addressed under the church’s secret prefix (media/<sha256>); those already there are listed in media/index.json ({ media: { <id>: { hash, size, type } } }), which readers fetch with the rest of the church; each missing one gets a presigned PUT (valid 15 minutes, its headers signed), after which the server publishes again; files no longer referenced are deleted. Limits: SYNC_MEDIA_MAX_FILE_BYTES per file (default 512 MiB) and SYNC_MEDIA_MAX_BYTES per church (default 2 GiB); what doesn’t fit is skipped with its reason. A path rotation leaves the media behind with the old prefix, and the server publishes it again.',
        security: [{ deviceToken: [] }],
        parameters: [churchId],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  items: {
                    type: 'array',
                    maxItems: 10000,
                    items: {
                      type: 'object',
                      required: ['id', 'hash', 'size', 'type'],
                      properties: {
                        id: { type: 'string', description: 'The media id synced rows use (<uuid>.<ext>)' },
                        hash: { type: 'string', description: 'sha256 of the file, hex' },
                        size: { type: 'integer', minimum: 1 },
                        type: {
                          type: 'string',
                          enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'What readers find, and what to upload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    available: { type: 'integer' },
                    uploads: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          hash: { type: 'string' },
                          url: { type: 'string', description: 'Presigned PUT URL' },
                          headers: { type: 'object', additionalProperties: { type: 'string' } },
                        },
                      },
                    },
                    skipped: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          reason: { type: 'string', enum: ['file_too_large', 'church_limit'] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': error('An invalid item (code invalid_request)'),
          '401': unauthorized,
          '403': error('Not the church server’s token (code forbidden)'),
          '503': notConfigured,
        },
      },
    },
    '/sync/churches/{churchId}/changes': {
      post: {
        summary: 'Write changes',
        description:
          'Authorizes every change against its author’s permissions, with the keys the app checks (songs.*, programs.*, users.*, settings.edit; bookmarks songs.view or bible.view; playlists any active user; a super admin only by a super admin), checks each baseVersion against the central version, then publishes them as one segment (log/<seq>-<nonce>.json.gz) and points head.json at it. All or nothing: 403 lists each refused change and the permission it needs, 409 the current versions. A phone’s changes are its own user’s; the church server names each change’s author (null: the server itself). Changes are checked in order, so a user or role changed earlier in the batch applies to the later ones; a user a change deactivates or removes has every device revoked and the path secret moves. Every 40 segments (SYNC_COMPACT_AFTER) a snapshot is written.',
        security: [{ deviceToken: [] }],
        parameters: [churchId],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  changes: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 1000,
                    items: { $ref: '#/components/schemas/Change' },
                  },
                },
                required: ['changes'],
              },
            },
          },
        },
        responses: {
          '200': {
            description:
              'Accepted: the segment’s seq, each row’s new version (= seq) and the current read location',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Location' },
                    {
                      type: 'object',
                      properties: {
                        seq: { type: 'integer' },
                        versions: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              type: { type: 'string' },
                              uuid: { type: 'string' },
                              version: { type: 'integer' },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': error('Invalid changes'),
          '401': unauthorized,
          '403': error(
            'A change the user may not make (code forbidden, rejected: [{ type, uuid, permission }])'
          ),
          '409': error(
            'A row changed first elsewhere (code conflict, conflicts: [{ type, uuid, version }]): pull, merge, send again'
          ),
          '413': error('Body over 8 MB'),
          '503': error(
            'Lost the race for the next seq too many times (code busy)'
          ),
        },
      },
    },
    '/sync/churches/{churchId}/compact': {
      post: {
        summary: 'Write a snapshot now',
        description:
          'Writes the whole library at the latest segment as snap/<seq>-<nonce>.json.gz and points head.json at it. Any valid token.',
        security: [{ deviceToken: [] }],
        parameters: [churchId],
        responses: {
          '200': {
            description: 'The snapshot’s seq',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { snapshotSeq: { type: 'integer' } },
                },
              },
            },
          },
          '401': unauthorized,
        },
      },
    },
    '/sync/churches/{churchId}/rotate': {
      post: {
        summary: 'Rotate the path secret',
        description:
          'Writes the library as one snapshot under a new secret path, switches to it and deletes everything under the old one. Needs users.edit.',
        security: [{ deviceToken: [] }],
        parameters: [churchId],
        responses: {
          '200': {
            description: 'The new read location',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Location' },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    ...ownerOpenApiPaths,
    ...libraryOpenApiPaths,
    '/sync/openapi.json': {
      get: {
        summary: 'This document',
        responses: { '200': { description: 'OpenAPI 3.1 JSON' } },
      },
    },
    '/sync/docs': {
      get: {
        summary: 'This document, rendered by Scalar',
        responses: { '200': { description: 'HTML' } },
      },
    },
  },
}

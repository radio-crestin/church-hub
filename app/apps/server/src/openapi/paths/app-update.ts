const localhostError = {
  description: 'Only accessible from localhost',
  content: {
    'application/json': {
      schema: { type: 'object', properties: { error: { type: 'string' } } },
    },
  },
}

const downloadState = {
  type: 'object',
  properties: {
    phase: {
      type: 'string',
      enum: ['idle', 'downloading', 'ready', 'installing', 'error'],
    },
    version: { type: 'string', nullable: true },
    filePath: { type: 'string', nullable: true },
    fileName: { type: 'string', nullable: true },
    receivedBytes: { type: 'integer' },
    totalBytes: { type: 'integer', nullable: true },
    error: { type: 'string', nullable: true },
  },
}

const config = {
  type: 'object',
  properties: {
    downloadDir: {
      type: 'string',
      nullable: true,
      description: 'The folder the operator chose; null means the default',
    },
    effectiveDownloadDir: {
      type: 'string',
      description: 'The folder actually written to',
    },
    defaultDir: {
      type: 'string',
      description: "The operating system's Downloads folder",
    },
  },
}

export const appUpdatePaths: Record<string, Record<string, unknown>> = {
  '/api/app-update/config': {
    get: {
      tags: ['App update'],
      summary: 'Read the download folder',
      description:
        'Where new versions are downloaded. Only accessible from localhost; requires settings.view.',
      responses: {
        '200': {
          description: 'Download folder',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { data: config } },
            },
          },
        },
        '403': localhostError,
      },
    },
    put: {
      tags: ['App update'],
      summary: 'Set the download folder',
      description:
        'Null or an empty string restores the system Downloads folder. A relative path is stored but ignored in favour of the default, because the sidecar performs the download and would otherwise resolve it against a working directory the operator never sees. Requires settings.edit.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { downloadDir: { type: 'string', nullable: true } },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Updated download folder',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { data: config } },
            },
          },
        },
        '400': localhostError,
        '403': localhostError,
      },
    },
  },
  '/api/app-update/status': {
    get: {
      tags: ['App update'],
      summary: 'Download progress / readiness',
      description:
        'Reports the download in flight. Passing `url` also answers whether that artifact is already in the folder from an earlier session, so the client can offer Install without downloading again.',
      parameters: [
        {
          name: 'url',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Release asset URL to look for on disk',
        },
        {
          name: 'version',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'Download state',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { data: downloadState } },
            },
          },
        },
        '403': localhostError,
      },
    },
  },
  '/api/app-update/download': {
    post: {
      tags: ['App update'],
      summary: 'Download a release artifact',
      description:
        'Streams the artifact into the configured folder, reporting progress through /api/app-update/status. Returns immediately. An artifact already on disk is reused rather than downloaded again. Requires settings.edit.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['url'],
              properties: {
                url: { type: 'string' },
                version: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Download started (or an existing artifact reused)',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { data: downloadState } },
            },
          },
        },
        '400': localhostError,
        '403': localhostError,
      },
    },
  },
  '/api/app-update/cancel': {
    post: {
      tags: ['App update'],
      summary: 'Abort a download in flight',
      responses: {
        '200': {
          description: 'Download state after aborting',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { data: downloadState } },
            },
          },
        },
        '403': localhostError,
      },
    },
  },
  '/api/app-update/install': {
    post: {
      tags: ['App update'],
      summary: 'Install the downloaded artifact',
      description:
        'Starts a detached helper that waits for the app to quit, installs without any prompts (bundle swap on macOS, silent NSIS on Windows) and relaunches. User data is untouched: the database lives in the per-user data directory and migrations run on the next boot. Requires settings.edit.',
      responses: {
        '200': {
          description: 'Installer started; the caller should now quit the app',
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
        '400': {
          description:
            'Nothing downloaded (`no_downloaded_artifact`) or the platform has no installer path (`unsupported_platform:<platform>`)',
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
}

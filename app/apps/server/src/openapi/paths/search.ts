const errorResponse = {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
}

const chromaStatusSchema = {
  type: 'object',
  properties: {
    state: {
      type: 'string',
      enum: ['disabled', 'stopped', 'starting', 'syncing', 'ready', 'error'],
      description: 'Chroma engine lifecycle state',
    },
    port: {
      type: 'integer',
      nullable: true,
      description: 'Local port the Chroma server listens on',
    },
    counts: {
      type: 'object',
      properties: {
        songs: { type: 'integer' },
        bible_verses: { type: 'integer' },
        schedules: { type: 'integer' },
      },
      description: 'Documents per Chroma collection',
    },
    progress: {
      type: 'number',
      description: 'Sync progress 0..1 while state is syncing',
    },
    step: { type: 'string', nullable: true },
    lastError: { type: 'string', nullable: true },
    lastFullSyncMs: { type: 'integer', nullable: true },
    lastFullSyncAt: { type: 'integer', nullable: true },
  },
}

export const searchPaths: Record<string, Record<string, unknown>> = {
  '/api/search/engine': {
    get: {
      tags: ['Search'],
      summary: 'Get the active search engine',
      description:
        'Returns the configured search engine (sqlite | chroma-semantic | chroma-keyword), the effective engine for the current request (Chroma engines fall back to SQLite until the Chroma sync is ready) and the Chroma status.',
      responses: {
        '200': {
          description: 'Current engine configuration',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      configured: {
                        type: 'string',
                        enum: ['sqlite', 'chroma-semantic', 'chroma-keyword'],
                      },
                      effective: {
                        type: 'string',
                        enum: ['sqlite', 'chroma-semantic', 'chroma-keyword'],
                      },
                      fallback: {
                        type: 'boolean',
                        description:
                          'true when a Chroma engine is configured but SQLite is serving (Chroma not ready)',
                      },
                      chroma: chromaStatusSchema,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    put: {
      tags: ['Search'],
      summary: 'Switch the search engine',
      description:
        'Persists the search engine selection used by songs, bible and schedules search. Part of the ChromaDB search experiment — SQLite stays the source of truth.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['engine'],
              properties: {
                engine: {
                  type: 'string',
                  enum: ['sqlite', 'chroma-semantic', 'chroma-keyword'],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Engine switched' },
        '400': { description: 'Invalid engine', ...errorResponse },
      },
    },
  },
  '/api/search/chroma-status': {
    get: {
      tags: ['Search'],
      summary: 'ChromaDB server and sync status',
      description:
        'Lifecycle state of the embedded Chroma server plus SQLite→Chroma sync progress and per-collection document counts.',
      responses: {
        '200': {
          description: 'Chroma status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { data: chromaStatusSchema },
              },
            },
          },
        },
      },
    },
  },
  '/api/search/chroma-resync': {
    post: {
      tags: ['Search'],
      summary: 'Rebuild ChromaDB from SQLite',
      description:
        'Drops all Chroma collections and re-syncs everything from SQLite (used after database import/restore — Chroma data is derived). Runs in the background; track progress via /api/search/chroma-status.',
      responses: {
        '200': {
          description: 'Resync started',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: { started: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/search/benchmark': {
    post: {
      tags: ['Search'],
      summary: 'Benchmark SQLite FTS vs ChromaDB search',
      description:
        'Runs the same queries through SQLite FTS5, Chroma keyword and Chroma semantic search and reports per-query timings plus top-10 result overlap vs the SQLite baseline.',
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                domain: { type: 'string', enum: ['songs', 'bible'] },
                queries: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Custom queries (max 20); defaults per domain',
                },
                iterations: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 20,
                  default: 5,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Benchmark report',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      domain: { type: 'string' },
                      iterations: { type: 'integer' },
                      engines: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            engine: { type: 'string' },
                            available: { type: 'boolean' },
                            totalAvgMs: { type: 'number' },
                            queries: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  query: { type: 'string' },
                                  avgMs: { type: 'number' },
                                  minMs: { type: 'number' },
                                  maxMs: { type: 'number' },
                                  resultCount: { type: 'integer' },
                                  topResult: {
                                    type: 'string',
                                    nullable: true,
                                  },
                                  overlapWithSqlite: {
                                    type: 'number',
                                    nullable: true,
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
              },
            },
          },
        },
        '500': { description: 'Benchmark failed', ...errorResponse },
      },
    },
  },
}

/** Drive appDataFolder alias (same private folder the backups live in). */
export const APP_DATA_FOLDER = 'appDataFolder'

/**
 * Name of the single shared library file in the user's Drive appDataFolder.
 * Every device merges into and re-uploads this same file.
 */
export const LIBRARY_FILE_NAME = 'church-hub-sync-library-v1.json.gz'

export const LIBRARY_MIME_TYPE = 'application/gzip'

/** Version of the serialized library format, for forward compatibility. */
export const LIBRARY_SCHEMA_VERSION = 1

/** Tombstones older than this are pruned from both the DB and the file. */
export const TOMBSTONE_RETENTION_DAYS = 90

/** Cap on rows kept in the sync_updates feed (older seen rows are pruned). */
export const MAX_SYNC_UPDATES = 200

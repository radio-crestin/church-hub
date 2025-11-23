# Database Module

This module provides SQLite database functionality for the Church Hub server using Bun's built-in SQLite support.

## Features

- **SQLite Database**: Lightweight, file-based database using Bun's native SQLite
- **WAL Mode**: Write-Ahead Logging for better concurrency
- **Foreign Keys**: Enabled for referential integrity
- **Auto-migration**: Schema is automatically created on startup
- **Debug Logging**: Controlled via `DEBUG` environment variable

## Database Schema

The database includes three tables for storing application data:

### 1. `app_settings`
Stores application-level configuration (theme, language, etc.)

### 2. `user_preferences`
Stores user-specific configurations and preferences

### 3. `cache_metadata`
Stores cache and synchronization metadata

**Table Structure:**
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
key           TEXT NOT NULL UNIQUE
value         TEXT NOT NULL
created_at    INTEGER (Unix timestamp)
updated_at    INTEGER (Unix timestamp)
```

## Configuration

Set these environment variables in `.env`:

```bash
# Database path (default: ./data/app.db)
DATABASE_PATH=./data/app.db

# Enable debug logging (optional)
DEBUG=true
```

## API Usage

### Server-side (apps/server/src/)

```typescript
import { initializeDatabase, getDatabase, closeDatabase } from './db';
import { upsertSetting, getSetting, deleteSetting, getAllSettings } from './service';

// Initialize on startup
const db = await initializeDatabase();
runMigrations(db);

// Upsert a setting
upsertSetting('app_settings', { key: 'theme', value: 'dark' });

// Get a setting
const setting = getSetting('app_settings', 'theme');

// Get all settings
const all = getAllSettings('user_preferences');

// Delete a setting
deleteSetting('cache_metadata', 'last_sync');

// Close on shutdown
closeDatabase();
```

### Client-side (apps/client/src/)

```typescript
import { upsertSetting, getSetting, getAllSettings, deleteSetting } from '@/service';

// Upsert a setting
await upsertSetting('app_settings', { key: 'theme', value: 'dark' });

// Get a setting
const setting = await getSetting('app_settings', 'theme');
console.log(setting); // { id: 1, key: 'theme', value: 'dark', created_at: ..., updated_at: ... }

// Get all settings
const all = await getAllSettings('user_preferences');

// Delete a setting
await deleteSetting('app_settings', 'theme');
```

## HTTP API Endpoints

All endpoints are protected by auth middleware in production.

### Get a setting
```bash
GET /api/settings/:table/:key
```

### Get all settings from a table
```bash
GET /api/settings/:table
```

### Upsert a setting
```bash
POST /api/settings/:table
Content-Type: application/json

{
  "key": "theme",
  "value": "dark"
}
```

### Delete a setting
```bash
DELETE /api/settings/:table/:key
```

**Available tables:**
- `app_settings`
- `user_preferences`
- `cache_metadata`

## File Structure

```
src/db/
├── index.ts           # Exports
├── connection.ts      # SQLite connection management
├── migrations.ts      # Schema migrations
├── schema.sql         # SQL schema definitions
└── README.md          # This file

src/service/
├── index.ts           # Exports
└── settings/
    ├── index.ts       # Exports
    ├── settings.ts    # CRUD operations
    └── types.ts       # TypeScript types
```

## Notes

- Window state (position, size, monitor) is managed by `tauri-plugin-window-state` plugin
- This database is for general application settings and configurations
- All service operations follow the pattern: only `upsert` and `delete` (as per guidelines)
- The database file is stored in `./data/` by default and is excluded from git

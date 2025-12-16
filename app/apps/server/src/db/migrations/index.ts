import type { Database } from 'bun:sqlite'
import {
  runMigrations as runMigrationsEngine,
  type MigrationResult,
} from './engine'
import { migration as m001 } from './versions/001_initial_schema'

const migrations = [m001]

export function runMigrations(db: Database): MigrationResult {
  return runMigrationsEngine(db, migrations)
}

export type { MigrationResult }

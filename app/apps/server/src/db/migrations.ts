import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "bun:sqlite";

const DEBUG = process.env.DEBUG === "true";

/**
 * Logs debug messages if DEBUG env variable is enabled
 */
function log(level: "debug" | "info" | "warning" | "error", message: string) {
  if (level === "debug" && !DEBUG) return;
  console.log(`[${level.toUpperCase()}] [MIGRATIONS] ${message}`);
}

/**
 * Runs database migrations
 * Executes the schema.sql file to create tables and indexes
 */
export function runMigrations(db: Database): void {
  try {
    log("info", "Running database migrations...");

    // Get the current file's directory
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const schemaPath = join(__dirname, "schema.sql");

    log("debug", `Loading schema from: ${schemaPath}`);

    // Read and execute schema
    const schema = readFileSync(schemaPath, "utf-8");
    db.run(schema);

    log("info", "Migrations completed successfully");
  } catch (error) {
    log("error", `Migration failed: ${error}`);
    throw error;
  }
}

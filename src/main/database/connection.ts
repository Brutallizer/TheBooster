// ============================================
// Database Connection (better-sqlite3)
// ============================================
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { initSchema } from './schema';
import log from 'electron-log';

let db: Database.Database | null = null;

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'multiaccount-manager.db');
}

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = getDbPath();
    log.info(`[DB] Opening database at: ${dbPath}`);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    log.info('[DB] Database initialized successfully');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    log.info('[DB] Database closed');
  }
}

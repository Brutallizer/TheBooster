// ============================================
// Database Schema
// ============================================
import Database from 'better-sqlite3';

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fingerprint_config TEXT NOT NULL,
      proxy_id TEXT,
      cookies_path TEXT,
      storage_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used INTEGER,
      account_type TEXT DEFAULT 'free',
      notes TEXT DEFAULT '',
      FOREIGN KEY (proxy_id) REFERENCES proxies(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS proxies (
      id TEXT PRIMARY KEY,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT,
      password TEXT,
      proxy_type TEXT DEFAULT 'http',
      country TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      login_timestamp INTEGER NOT NULL,
      logout_timestamp INTEGER,
      cookies_snapshot TEXT,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_last_used ON profiles(last_used);
    CREATE INDEX IF NOT EXISTS idx_sessions_profile ON sessions(profile_id);
  `);
}

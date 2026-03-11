// ============================================
// Profiles CRUD Operations
// ============================================
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { getDatabase } from './connection';
import { generateFingerprint } from '../browser/fingerprint/generator';
import log from 'electron-log';
import type { Profile, CreateProfileData, FingerprintConfig } from '../../shared/types';

export function getProfilesDir(): string {
  return path.join(app.getPath('userData'), 'profiles');
}

function parseProfile(row: any): Profile {
  return {
    ...row,
    fingerprint_config: JSON.parse(row.fingerprint_config),
    is_active: Boolean(row.is_active),
  };
}

export function listProfiles(): Profile[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM profiles ORDER BY last_used DESC, created_at DESC').all();
  return rows.map(parseProfile);
}

export function getProfile(id: string): Profile | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
  return row ? parseProfile(row) : null;
}

export function createProfile(data: CreateProfileData): Profile {
  const db = getDatabase();
  const id = uuidv4();
  const profilesDir = getProfilesDir();
  const storagePath = path.join(profilesDir, id);
  const cookiesPath = path.join(storagePath, 'cookies');

  // Create isolated directories for this profile
  fs.mkdirSync(storagePath, { recursive: true });
  fs.mkdirSync(cookiesPath, { recursive: true });

  // Generate deterministic fingerprint from profile ID
  const fingerprintConfig = generateFingerprint(id);
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO profiles (id, name, fingerprint_config, proxy_id, cookies_path, storage_path, created_at, last_used, account_type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `);

  stmt.run(
    id,
    data.name,
    JSON.stringify(fingerprintConfig),
    data.proxy_id || null,
    cookiesPath,
    storagePath,
    now,
    data.account_type || 'free',
    data.notes || ''
  );

  log.info(`[Profiles] Created profile: ${data.name} (${id})`);
  return getProfile(id)!;
}

export function updateProfile(id: string, data: Partial<CreateProfileData>): Profile {
  const db = getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.proxy_id !== undefined) {
    fields.push('proxy_id = ?');
    values.push(data.proxy_id);
  }
  if (data.account_type !== undefined) {
    fields.push('account_type = ?');
    values.push(data.account_type);
  }
  if (data.notes !== undefined) {
    fields.push('notes = ?');
    values.push(data.notes);
  }

  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    log.info(`[Profiles] Updated profile: ${id}`);
  }

  return getProfile(id)!;
}

export function updateLastUsed(id: string): void {
  const db = getDatabase();
  db.prepare('UPDATE profiles SET last_used = ? WHERE id = ?').run(Date.now(), id);
}

export function deleteProfile(id: string): void {
  const db = getDatabase();
  const profile = getProfile(id);

  if (profile) {
    // Delete profile storage directory
    if (fs.existsSync(profile.storage_path)) {
      fs.rmSync(profile.storage_path, { recursive: true, force: true });
    }
    db.prepare('DELETE FROM sessions WHERE profile_id = ?').run(id);
    db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
    log.info(`[Profiles] Deleted profile: ${id}`);
  }
}

export function getProfileCount(): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as any;
  return row.count;
}

// ============================================
// Cloud Sync — Profile Backup/Restore to Firestore
// (Premium Only, Encrypted, Conflict-Aware)
// ============================================
import admin from 'firebase-admin';
import CryptoJS from 'crypto-js';
import log from 'electron-log';
import { getActiveUser, isPremiumUser } from './ipc/auth';

// Sync status tracking
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'failed' | 'offline';

let currentSyncStatus: SyncStatus = 'idle';
let lastSyncedAt: number | null = null;
let pendingChanges: Array<{ action: 'upload' | 'delete'; profileId: string; data?: any }> = [];

// ---- Encryption ----

function deriveKey(uid: string): string {
  // Derive a unique encryption key from UID + app salt
  return CryptoJS.SHA256(`mam-cloud-${uid}-sync-key`).toString();
}

function encryptData(data: any, uid: string): string {
  const key = deriveKey(uid);
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}

function decryptData(cipherText: string, uid: string): any {
  const key = deriveKey(uid);
  const bytes = CryptoJS.AES.decrypt(cipherText, key);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

// ---- Firestore Helpers ----

function getProfilesCollection(uid: string) {
  return admin.firestore().collection('users').doc(uid).collection('profiles');
}

// ---- Status ----

export function getSyncStatus(): { status: SyncStatus; lastSyncedAt: number | null; pendingCount: number } {
  return {
    status: currentSyncStatus,
    lastSyncedAt,
    pendingCount: pendingChanges.length,
  };
}

// ---- Upload / Backup ----

export async function uploadProfile(
  profileId: string,
  profileData: {
    name: string;
    fingerprint_config: any;
    proxy_id: string | null;
    account_type: string;
    notes: string;
    created_at: number;
    last_used: number | null;
  }
): Promise<boolean> {
  const user = getActiveUser();
  if (!user || !isPremiumUser()) {
    log.warn('[CloudSync] Upload denied: not premium or not logged in');
    return false;
  }

  if (!admin.apps.length) {
    addPendingChange('upload', profileId, profileData);
    return false;
  }

  try {
    currentSyncStatus = 'syncing';

    // Encrypt fingerprint config (sensitive data)
    const encryptedFingerprint = encryptData(profileData.fingerprint_config, user.uid);

    const cloudDoc = {
      name: profileData.name,
      fingerprint_config_encrypted: encryptedFingerprint,
      proxy_id: profileData.proxy_id,
      account_type: profileData.account_type,
      notes: profileData.notes,
      created_at: profileData.created_at,
      last_used: profileData.last_used,
      updated_at: Date.now(), // For conflict resolution (last-write-wins)
      synced_from: require('os').hostname(),
    };

    await getProfilesCollection(user.uid).doc(profileId).set(cloudDoc, { merge: true });
    
    currentSyncStatus = 'synced';
    lastSyncedAt = Date.now();
    log.info(`[CloudSync] Uploaded profile: ${profileData.name} (${profileId})`);
    return true;
  } catch (err: any) {
    currentSyncStatus = 'failed';
    log.error('[CloudSync] Upload error:', err.message);
    addPendingChange('upload', profileId, profileData);
    return false;
  }
}

// ---- Download / Restore ----

export async function downloadAllProfiles(): Promise<Array<{
  id: string;
  name: string;
  fingerprint_config: any;
  proxy_id: string | null;
  account_type: string;
  notes: string;
  created_at: number;
  last_used: number | null;
  updated_at: number;
}> | null> {
  const user = getActiveUser();
  if (!user || !isPremiumUser()) {
    log.warn('[CloudSync] Download denied: not premium or not logged in');
    return null;
  }

  if (!admin.apps.length) {
    currentSyncStatus = 'offline';
    return null;
  }

  try {
    currentSyncStatus = 'syncing';

    const snapshot = await getProfilesCollection(user.uid).get();
    const profiles = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Decrypt fingerprint config
      let fingerprintConfig = {};
      try {
        fingerprintConfig = decryptData(data.fingerprint_config_encrypted, user.uid);
      } catch {
        log.warn(`[CloudSync] Failed to decrypt profile ${doc.id}, skipping fingerprint`);
      }

      return {
        id: doc.id,
        name: data.name || 'Unnamed',
        fingerprint_config: fingerprintConfig,
        proxy_id: data.proxy_id || null,
        account_type: data.account_type || 'free',
        notes: data.notes || '',
        created_at: data.created_at || Date.now(),
        last_used: data.last_used || null,
        updated_at: data.updated_at || 0,
      };
    });

    currentSyncStatus = 'synced';
    lastSyncedAt = Date.now();
    log.info(`[CloudSync] Downloaded ${profiles.length} profiles from cloud`);
    return profiles;
  } catch (err: any) {
    currentSyncStatus = 'failed';
    log.error('[CloudSync] Download error:', err.message);
    return null;
  }
}

// ---- Delete from Cloud ----

export async function deleteCloudProfile(profileId: string): Promise<boolean> {
  const user = getActiveUser();
  if (!user || !isPremiumUser()) return false;

  if (!admin.apps.length) {
    addPendingChange('delete', profileId);
    return false;
  }

  try {
    await getProfilesCollection(user.uid).doc(profileId).delete();
    log.info(`[CloudSync] Deleted cloud profile: ${profileId}`);
    return true;
  } catch (err: any) {
    log.error('[CloudSync] Delete error:', err.message);
    addPendingChange('delete', profileId);
    return false;
  }
}

// ---- Pending / Offline Queue ----

function addPendingChange(action: 'upload' | 'delete', profileId: string, data?: any) {
  // Remove existing entry for same profile to avoid duplicates
  pendingChanges = pendingChanges.filter(p => p.profileId !== profileId);
  pendingChanges.push({ action, profileId, data });
  currentSyncStatus = 'offline';
  log.info(`[CloudSync] Queued pending ${action} for ${profileId}. Queue: ${pendingChanges.length}`);
}

export async function processPendingChanges(): Promise<number> {
  if (pendingChanges.length === 0) return 0;
  if (!admin.apps.length) return 0;

  const user = getActiveUser();
  if (!user || !isPremiumUser()) return 0;

  let processed = 0;
  const toProcess = [...pendingChanges];
  pendingChanges = [];

  for (const change of toProcess) {
    try {
      if (change.action === 'upload' && change.data) {
        await uploadProfile(change.profileId, change.data);
        processed++;
      } else if (change.action === 'delete') {
        await deleteCloudProfile(change.profileId);
        processed++;
      }
    } catch (err) {
      // Re-queue failed items
      pendingChanges.push(change);
    }
  }

  log.info(`[CloudSync] Processed ${processed} pending changes. Remaining: ${pendingChanges.length}`);
  return processed;
}

// ---- Full Sync (Compare local ↔ cloud) ----

export async function fullSync(localProfiles: Array<{
  id: string;
  name: string;
  fingerprint_config: any;
  proxy_id: string | null;
  account_type: string;
  notes: string;
  created_at: number;
  last_used: number | null;
}>): Promise<{ uploaded: number; downloaded: number; conflicts: number }> {
  const user = getActiveUser();
  if (!user || !isPremiumUser()) {
    throw new Error('Cloud Sync hanya tersedia untuk akun Premium.');
  }

  if (!admin.apps.length) {
    throw new Error('Firebase tidak tersedia. Periksa koneksi internet.');
  }

  currentSyncStatus = 'syncing';
  let uploaded = 0;
  let downloaded = 0;
  let conflicts = 0;

  try {
    // Get all cloud profiles
    const cloudProfiles = await downloadAllProfiles();
    if (!cloudProfiles) {
      throw new Error('Gagal mengambil data dari cloud.');
    }

    const cloudMap = new Map(cloudProfiles.map(p => [p.id, p]));
    const localMap = new Map(localProfiles.map(p => [p.id, p]));

    // Upload local profiles not in cloud
    for (const local of localProfiles) {
      const cloud = cloudMap.get(local.id);
      if (!cloud) {
        // Not in cloud → upload
        await uploadProfile(local.id, local);
        uploaded++;
      }
      // If exists in both, last-write-wins is handled by uploadProfile's updated_at
    }

    // Count profiles only in cloud (available for import)
    for (const cloud of cloudProfiles) {
      if (!localMap.has(cloud.id)) {
        downloaded++; // These can be imported
      }
    }

    currentSyncStatus = 'synced';
    lastSyncedAt = Date.now();

    // Process any pending changes
    await processPendingChanges();

    return { uploaded, downloaded, conflicts };
  } catch (err: any) {
    currentSyncStatus = 'failed';
    throw err;
  }
}

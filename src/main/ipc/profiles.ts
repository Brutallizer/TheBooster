// ============================================
// IPC Handlers: Profiles (with Cloud Sync & Workspaces)
// ============================================
import { ipcMain } from 'electron';
import { listProfiles, createProfile, getProfile, deleteProfile, updateProfile, getProfileCount } from '../database/profiles';
import { launchBrowser, closeBrowser, isProfileRunning } from '../browser/engine';
import { getActiveUser, isPremiumUser } from './auth';
import { uploadProfile, deleteCloudProfile, downloadAllProfiles, fullSync, getSyncStatus, processPendingChanges } from '../cloud-sync';
import { getActiveWorkspaceId, getWorkspaceProfiles, createWorkspaceProfile, updateWorkspaceProfile, deleteWorkspaceProfile, getWorkspaceProfileById, acquireProfileLock, releaseProfileLock } from '../workspace';
import log from 'electron-log';

const FREE_PROFILE_LIMIT = 3;

// Auto-sync helper (fire-and-forget, non-blocking)
async function autoSyncProfile(profileId: string) {
  if (!isPremiumUser() || getActiveWorkspaceId()) return; // Don't auto-sync local DB if workspace is active
  try {
    const profile = getProfile(profileId);
    if (profile) {
      await uploadProfile(profileId, {
        name: profile.name,
        fingerprint_config: profile.fingerprint_config,
        proxy_id: profile.proxy_id,
        account_type: profile.account_type,
        notes: profile.notes,
        created_at: profile.created_at,
        last_used: profile.last_used,
      });
    }
  } catch (err) {
    log.warn(`[IPC] Auto-sync failed for ${profileId}:`, err);
  }
}

export function registerProfileHandlers(): void {
  ipcMain.handle('profiles:list', async () => {
    try {
      const user = getActiveUser();
      const wsId = getActiveWorkspaceId();

      // Workspace Mode
      if (wsId) {
        const wsProfiles = await getWorkspaceProfiles(wsId);
        return {
          profiles: wsProfiles.map((p: any) => ({
            ...p,
            is_running: isProfileRunning(p.id) || false,
          })),
          limit: null,
          tier: user?.tier || 'premium',
          syncStatus: { status: 'idle', lastSyncedAt: Date.now(), pendingCount: 0 },
          isWorkspace: true,
        };
      }

      // Personal / Local Mode
      const profiles = listProfiles();
      const syncStatus = getSyncStatus();
      return {
        profiles: profiles.map(p => ({
          ...p,
          is_running: isProfileRunning(p.id),
        })),
        limit: isPremiumUser() ? null : FREE_PROFILE_LIMIT,
        tier: user?.tier || 'free',
        syncStatus: syncStatus,
        isWorkspace: false,
      };
    } catch (err: any) {
      log.error('[IPC] profiles:list error:', err);
      throw err;
    }
  });

  ipcMain.handle('profiles:create', async (_event, data) => {
    try {
      const wsId = getActiveWorkspaceId();
      
      // Workspace Mode
      if (wsId) {
        return await createWorkspaceProfile(wsId, data);
      }

      // Personal / Local Mode
      if (!isPremiumUser()) {
        const currentCount = getProfileCount();
        if (currentCount >= FREE_PROFILE_LIMIT) {
          throw new Error(`Limit tercapai! Akun Free hanya bisa membuat ${FREE_PROFILE_LIMIT} profil. Upgrade ke Premium untuk unlimited.`);
        }
      }
      const profile = createProfile(data);
      autoSyncProfile(profile.id);
      return profile;
    } catch (err: any) {
      log.error('[IPC] profiles:create error:', err);
      throw err;
    }
  });

  ipcMain.handle('profiles:open', async (_event, id: string) => {
    try {
      const wsId = getActiveWorkspaceId();
      const user = getActiveUser();
      let profile;

      if (wsId && user) {
        profile = await getWorkspaceProfileById(wsId, id);
        if (profile) {
          const lock = acquireProfileLock(id, user.uid, user.email);
          if (!lock.success) {
            return { success: false, error: `Profil sedang digunakan oleh ${lock.lockedBy}. Tunggu mereka selesai.` };
          }
        }
      } else {
        profile = getProfile(id);
      }

      if (!profile) {
        return { success: false, error: 'Profile not found' };
      }
      await launchBrowser(profile);
      return { success: true };
    } catch (err: any) {
      log.error('[IPC] profiles:open error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('profiles:close', async (_event, id: string) => {
    try {
      await closeBrowser(id);
      
      const wsId = getActiveWorkspaceId();
      const user = getActiveUser();
      if (wsId && user) {
        releaseProfileLock(id, user.uid);
      }
    } catch (err: any) {
      log.error('[IPC] profiles:close error:', err);
      throw err;
    }
  });

  ipcMain.handle('profiles:delete', async (_event, id: string) => {
    try {
      if (isProfileRunning(id)) {
        await closeBrowser(id);
      }

      const wsId = getActiveWorkspaceId();
      if (wsId) {
        await deleteWorkspaceProfile(wsId, id);
      } else {
        deleteProfile(id);
        deleteCloudProfile(id).catch(() => {});
      }
    } catch (err: any) {
      log.error('[IPC] profiles:delete error:', err);
      throw err;
    }
  });

  ipcMain.handle('profiles:update', async (_event, id: string, data) => {
    try {
      const wsId = getActiveWorkspaceId();
      if (wsId) {
        await updateWorkspaceProfile(wsId, id, data);
        return { id, ...data };
      }

      const profile = updateProfile(id, data);
      autoSyncProfile(id);
      return profile;
    } catch (err: any) {
      log.error('[IPC] profiles:update error:', err);
      throw err;
    }
  });

  // ---- Cloud Sync Handlers (Personal Only) ----

  ipcMain.handle('profiles:sync', async () => {
    try {
      const localProfiles = listProfiles();
      const result = await fullSync(localProfiles.map(p => ({
        id: p.id,
        name: p.name,
        fingerprint_config: p.fingerprint_config,
        proxy_id: p.proxy_id,
        account_type: p.account_type,
        notes: p.notes,
        created_at: p.created_at,
        last_used: p.last_used,
      })));
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[IPC] profiles:sync error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('profiles:sync-status', async () => {
    return getSyncStatus();
  });

  ipcMain.handle('profiles:import-cloud', async () => {
    try {
      const cloudProfiles = await downloadAllProfiles();
      if (!cloudProfiles) {
        return { success: false, error: 'Gagal mengambil data dari cloud.' };
      }

      const localProfiles = listProfiles();
      const localIds = new Set(localProfiles.map(p => p.id));

      let imported = 0;
      for (const cp of cloudProfiles) {
        if (!localIds.has(cp.id)) {
          createProfile({
            name: cp.name,
            proxy_id: cp.proxy_id,
            account_type: cp.account_type as 'free' | 'premium',
            notes: cp.notes,
          });
          imported++;
        }
      }

      return { success: true, imported, total: cloudProfiles.length };
    } catch (err: any) {
      log.error('[IPC] profiles:import-cloud error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('profiles:retry-pending', async () => {
    try {
      const processed = await processPendingChanges();
      return { success: true, processed };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

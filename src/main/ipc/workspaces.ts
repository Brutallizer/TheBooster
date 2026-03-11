// ============================================
// IPC Handlers: Workspaces
// ============================================
import { ipcMain } from 'electron';
import {
  createWorkspace,
  listWorkspaces,
  inviteToWorkspace,
  removeFromWorkspace,
  deleteWorkspace,
  setActiveWorkspaceId,
  getActiveWorkspaceId,
  acquireProfileLock,
  releaseProfileLock,
} from '../workspace';
import log from 'electron-log';

export function registerWorkspaceHandlers(): void {
  ipcMain.handle('workspace:list', async () => {
    try {
      return await listWorkspaces();
    } catch (err: any) {
      log.error('[IPC] workspace:list error:', err);
      return [];
    }
  });

  ipcMain.handle('workspace:create', async (_event, name: string) => {
    try {
      const ws = await createWorkspace(name);
      return { success: true, workspace: ws };
    } catch (err: any) {
      log.error('[IPC] workspace:create error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workspace:invite', async (_event, workspaceId: string, email: string, role: string) => {
    try {
      await inviteToWorkspace(workspaceId, email, role as 'member' | 'viewer');
      return { success: true };
    } catch (err: any) {
      log.error('[IPC] workspace:invite error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workspace:remove-member', async (_event, workspaceId: string, targetUid: string) => {
    try {
      await removeFromWorkspace(workspaceId, targetUid);
      return { success: true };
    } catch (err: any) {
      log.error('[IPC] workspace:remove-member error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workspace:delete', async (_event, workspaceId: string) => {
    try {
      await deleteWorkspace(workspaceId);
      return { success: true };
    } catch (err: any) {
      log.error('[IPC] workspace:delete error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workspace:set-active', async (_event, workspaceId: string | null) => {
    setActiveWorkspaceId(workspaceId);
    return { success: true };
  });

  ipcMain.handle('workspace:get-active', async () => {
    return { workspaceId: getActiveWorkspaceId() };
  });

  ipcMain.handle('workspace:lock-profile', async (_event, profileId: string, uid: string, email: string) => {
    return acquireProfileLock(profileId, uid, email);
  });

  ipcMain.handle('workspace:unlock-profile', async (_event, profileId: string, uid: string) => {
    releaseProfileLock(profileId, uid);
    return { success: true };
  });
}

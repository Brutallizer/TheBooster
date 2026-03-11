// ============================================
// IPC Handlers: Analytics
// ============================================
import { ipcMain } from 'electron';
import { getWorkspaceActivityLogs } from '../analytics';
import log from 'electron-log';

export function registerAnalyticsHandlers(): void {
  ipcMain.handle('analytics:get-logs', async (_event, workspaceId: string, limit?: number) => {
    try {
      return await getWorkspaceActivityLogs(workspaceId, limit);
    } catch (err: any) {
      log.error('[IPC] analytics:get-logs error:', err);
      return [];
    }
  });
}

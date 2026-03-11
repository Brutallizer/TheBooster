// ============================================
// IPC Handlers: Automation Engine
// ============================================
import { ipcMain } from 'electron';
import { runAutomationScript } from '../browser/automation';
import log from 'electron-log';
import { isPremiumUser } from './auth';

export function registerAutomationHandlers(): void {
  ipcMain.handle('automation:run', async (_event, profileId: string, scriptCode: string) => {
    try {
      if (!isPremiumUser()) {
        throw new Error('Fitur Automation Engine hanya tersedia untuk pengguna Premium.');
      }
      return await runAutomationScript(profileId, scriptCode);
    } catch (err: any) {
      log.error(`[IPC] automation:run error for profile ${profileId}:`, err);
      return { success: false, logs: [`[FATAL IPC Error] ${err.message}`], error: err.message };
    }
  });
}

// ============================================
// IPC Handlers: Auth (Secure Token Verification)
// ============================================
import { ipcMain } from 'electron';
import { verifyIdToken, isAdminInitialized } from '../firebase-admin';
import log from 'electron-log';

// In-memory store of verified user sessions
// Key: always 'current' (single user app), Value: user info
interface ActiveUser {
  uid: string;
  email: string;
  tier: 'free' | 'premium';
  verifiedAt: number;
}

let activeUser: ActiveUser | null = null;

export function getActiveUser(): ActiveUser | null {
  return activeUser;
}

export function isPremiumUser(): boolean {
  return activeUser?.tier === 'premium';
}

export function registerAuthHandlers(): void {
  // Verify Firebase ID token sent from renderer
  ipcMain.handle('auth:verify', async (_event, idToken: string) => {
    try {
      if (!isAdminInitialized()) {
        // Offline mode: trust the renderer (development only)
        log.warn('[Auth] Firebase Admin not initialized. Running in dev/offline mode.');
        activeUser = {
          uid: 'offline-user',
          email: 'dev@localhost',
          tier: 'free',
          verifiedAt: Date.now(),
        };
        return { success: true, tier: 'free', offline: true };
      }

      const result = await verifyIdToken(idToken);
      if (result) {
        activeUser = {
          uid: result.uid,
          email: result.email,
          tier: result.tier,
          verifiedAt: Date.now(),
        };
        log.info(`[Auth] User verified: ${result.email} (${result.tier})`);
        return { success: true, tier: result.tier };
      } else {
        activeUser = null;
        return { success: false, error: 'Token verification failed' };
      }
    } catch (err: any) {
      log.error('[Auth] verify error:', err);
      return { success: false, error: err.message };
    }
  });

  // Logout
  ipcMain.handle('auth:logout', async () => {
    activeUser = null;
    log.info('[Auth] User logged out');
    return { success: true };
  });

  // Get current user status
  ipcMain.handle('auth:status', async () => {
    if (activeUser) {
      return {
        loggedIn: true,
        uid: activeUser.uid,
        email: activeUser.email,
        tier: activeUser.tier,
      };
    }
    return { loggedIn: false };
  });
}

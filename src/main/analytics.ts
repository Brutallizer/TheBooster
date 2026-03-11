// ============================================
// Analytics & Activity Log Module
// ============================================
import admin from 'firebase-admin';
import log from 'electron-log';
import { getActiveUser } from './ipc/auth';

export interface SessionLog {
  id: string;
  workspaceId: string;
  profileId: string;
  profileName: string;
  uid: string;
  email: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  proxyHost: string | null;
}

// In-memory tracker for active sessions
interface ActiveSession {
  workspaceId: string;
  profileId: string;
  profileName: string;
  uid: string;
  email: string;
  startTime: number;
  proxyHost: string | null;
}

const activeSessions = new Map<string, ActiveSession>();

export function startSessionTracker(workspaceId: string, profileId: string, profileName: string, proxyHost: string | null) {
  const user = getActiveUser();
  if (!user || !admin.apps.length) return;

  activeSessions.set(profileId, {
    workspaceId,
    profileId,
    profileName,
    uid: user.uid,
    email: user.email,
    startTime: Date.now(),
    proxyHost,
  });
  
  log.info(`[Analytics] Started tracking session for profile: ${profileName}`);
}

export async function endSessionTracker(profileId: string) {
  const session = activeSessions.get(profileId);
  if (!session) return;

  activeSessions.delete(profileId);
  const endTime = Date.now();
  const durationSeconds = Math.floor((endTime - session.startTime) / 1000);

  // Minimum duration to log is 5 seconds to avoid spam
  if (durationSeconds < 5) return;

  try {
    const docRef = admin.firestore().collection('workspaces').doc(session.workspaceId).collection('activity_logs').doc();
    const logData: Omit<SessionLog, 'id'> = {
      workspaceId: session.workspaceId,
      profileId: session.profileId,
      profileName: session.profileName,
      uid: session.uid,
      email: session.email,
      startTime: session.startTime,
      endTime,
      durationSeconds,
      proxyHost: session.proxyHost,
    };

    await docRef.set(logData);
    log.info(`[Analytics] Logged session for ${session.profileName} (${durationSeconds}s)`);
  } catch (err: any) {
    log.error('[Analytics] Failed to log session:', err.message);
  }
}

export async function getWorkspaceActivityLogs(workspaceId: string, limit = 100): Promise<SessionLog[]> {
  const user = getActiveUser();
  if (!user || !admin.apps.length) return [];

  try {
    // Verify user is part of the workspace
    const wsDoc = await admin.firestore().collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists) return [];
    
    const wsData = wsDoc.data()!;
    const isMember = (wsData.members || []).some((m: any) => m.uid === user.uid);
    if (!isMember) throw new Error('Akses ditolak.');

    // Fetch logs
    const snapshot = await admin.firestore()
      .collection('workspaces')
      .doc(workspaceId)
      .collection('activity_logs')
      .orderBy('endTime', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SessionLog[];
  } catch (err: any) {
    log.error('[Analytics] getWorkspaceActivityLogs error:', err.message);
    return [];
  }
}

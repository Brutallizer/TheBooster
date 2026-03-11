// ============================================
// Workspace Module — Team Collaboration via Firestore
// ============================================
import admin from 'firebase-admin';
import log from 'electron-log';
import { getActiveUser, isPremiumUser } from './ipc/auth';

export interface WorkspaceMember {
  uid: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  members: WorkspaceMember[];
  createdAt: number;
}

// ---- Active Workspace ----

let activeWorkspaceId: string | null = null;

export function getActiveWorkspaceId(): string | null {
  return activeWorkspaceId;
}

export function setActiveWorkspaceId(id: string | null) {
  activeWorkspaceId = id;
  log.info(`[Workspace] Active workspace set to: ${id || 'personal'}`);
}

// ---- Session Lock (prevent 2 users opening same profile) ----

const sessionLocks = new Map<string, { uid: string; email: string; lockedAt: number }>();

export function acquireProfileLock(profileId: string, uid: string, email: string): { success: boolean; lockedBy?: string } {
  const existing = sessionLocks.get(profileId);
  if (existing && existing.uid !== uid) {
    // Check if lock is stale (> 30 minutes)
    const staleMs = 30 * 60 * 1000;
    if (Date.now() - existing.lockedAt < staleMs) {
      return { success: false, lockedBy: existing.email };
    }
  }
  sessionLocks.set(profileId, { uid, email, lockedAt: Date.now() });
  return { success: true };
}

export function releaseProfileLock(profileId: string, uid: string) {
  const existing = sessionLocks.get(profileId);
  if (existing && existing.uid === uid) {
    sessionLocks.delete(profileId);
  }
}

// ---- Firestore Helpers ----

function workspacesCol() {
  return admin.firestore().collection('workspaces');
}

// ---- CRUD ----

export async function createWorkspace(name: string): Promise<Workspace | null> {
  const user = getActiveUser();
  if (!user || !isPremiumUser()) {
    throw new Error('Hanya akun Premium yang bisa membuat Workspace.');
  }

  const docRef = workspacesCol().doc();
  const workspace: Omit<Workspace, 'id'> = {
    name,
    ownerId: user.uid,
    ownerEmail: user.email,
    members: [{
      uid: user.uid,
      email: user.email,
      role: 'admin',
      joinedAt: Date.now(),
    }],
    createdAt: Date.now(),
  };

  await docRef.set(workspace);
  log.info(`[Workspace] Created: ${name} (${docRef.id})`);
  return { id: docRef.id, ...workspace };
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const user = getActiveUser();
  if (!user) return [];

  if (!admin.apps.length) return [];

  try {
    // Query workspaces where user is a member
    const snapshot = await workspacesCol()
      .where('members', 'array-contains', { uid: user.uid, email: user.email, role: 'admin', joinedAt: 0 })
      .get();

    // Firestore array-contains doesn't support partial match on objects,
    // so we query all and filter client-side
    const allSnapshot = await workspacesCol().get();
    const workspaces: Workspace[] = [];

    for (const doc of allSnapshot.docs) {
      const data = doc.data();
      const isMember = (data.members || []).some((m: any) => m.uid === user.uid);
      if (isMember) {
        workspaces.push({
          id: doc.id,
          name: data.name,
          ownerId: data.ownerId,
          ownerEmail: data.ownerEmail,
          members: data.members || [],
          createdAt: data.createdAt,
        });
      }
    }

    return workspaces;
  } catch (err: any) {
    log.error('[Workspace] listWorkspaces error:', err.message);
    return [];
  }
}

export async function inviteToWorkspace(workspaceId: string, email: string, role: 'member' | 'viewer'): Promise<boolean> {
  const user = getActiveUser();
  if (!user) throw new Error('Tidak terautentikasi.');

  const docRef = workspacesCol().doc(workspaceId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Workspace tidak ditemukan.');

  const data = doc.data()!;
  const currentMember = (data.members || []).find((m: any) => m.uid === user.uid);
  if (!currentMember || currentMember.role !== 'admin') {
    throw new Error('Hanya Admin yang bisa mengundang anggota.');
  }

  // Check if already a member
  const alreadyMember = (data.members || []).some((m: any) => m.email === email);
  if (alreadyMember) throw new Error('User sudah menjadi anggota workspace ini.');

  // Find user UID by email from Firebase Auth
  let invitedUid = '';
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    invitedUid = userRecord.uid;
  } catch {
    throw new Error(`User dengan email "${email}" tidak ditemukan. Pastikan user sudah mendaftar.`);
  }

  const newMember: WorkspaceMember = {
    uid: invitedUid,
    email,
    role,
    joinedAt: Date.now(),
  };

  await docRef.update({
    members: admin.firestore.FieldValue.arrayUnion(newMember),
  });

  log.info(`[Workspace] Invited ${email} as ${role} to ${workspaceId}`);
  return true;
}

export async function removeFromWorkspace(workspaceId: string, targetUid: string): Promise<boolean> {
  const user = getActiveUser();
  if (!user) throw new Error('Tidak terautentikasi.');

  const docRef = workspacesCol().doc(workspaceId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Workspace tidak ditemukan.');

  const data = doc.data()!;
  const currentMember = (data.members || []).find((m: any) => m.uid === user.uid);
  if (!currentMember || currentMember.role !== 'admin') {
    throw new Error('Hanya Admin yang bisa mengeluarkan anggota.');
  }

  if (targetUid === data.ownerId) {
    throw new Error('Tidak bisa mengeluarkan pemilik workspace.');
  }

  const targetMember = (data.members || []).find((m: any) => m.uid === targetUid);
  if (!targetMember) throw new Error('User bukan anggota workspace ini.');

  await docRef.update({
    members: (data.members || []).filter((m: any) => m.uid !== targetUid),
  });

  log.info(`[Workspace] Removed ${targetUid} from ${workspaceId}`);
  return true;
}

export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  const user = getActiveUser();
  if (!user) throw new Error('Tidak terautentikasi.');

  const docRef = workspacesCol().doc(workspaceId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Workspace tidak ditemukan.');

  const data = doc.data()!;
  if (data.ownerId !== user.uid) {
    throw new Error('Hanya pemilik yang bisa menghapus workspace.');
  }

  await docRef.delete();
  if (activeWorkspaceId === workspaceId) {
    activeWorkspaceId = null;
  }
  log.info(`[Workspace] Deleted workspace: ${workspaceId}`);
  return true;
}

export function getUserRoleInWorkspace(workspace: Workspace, uid: string): string | null {
  const member = workspace.members.find(m => m.uid === uid);
  return member ? member.role : null;
}

// ---- Workspace Profiles CRUD ----

export async function getWorkspaceProfiles(workspaceId: string): Promise<any[]> {
  const user = getActiveUser();
  if (!user) return [];
  try {
    const snapshot = await workspacesCol().doc(workspaceId).collection('profiles').get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err) {
    log.error('[Workspace] getProfiles error:', err);
    return [];
  }
}

export async function getWorkspaceProfileById(workspaceId: string, profileId: string): Promise<any | null> {
  try {
    const doc = await workspacesCol().doc(workspaceId).collection('profiles').doc(profileId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch {
    return null;
  }
}

export async function createWorkspaceProfile(workspaceId: string, data: any): Promise<any> {
  const user = getActiveUser();
  if (!user) throw new Error('Unauthenticated');
  
  const docRef = workspacesCol().doc(workspaceId).collection('profiles').doc();
  const profile = {
    ...data,
    id: docRef.id,
    created_at: Date.now(),
    last_used: null,
    created_by: user.email,
  };
  
  await docRef.set(profile);
  return profile;
}

export async function updateWorkspaceProfile(workspaceId: string, profileId: string, data: any): Promise<void> {
  const docRef = workspacesCol().doc(workspaceId).collection('profiles').doc(profileId);
  await docRef.update(data);
}

export async function deleteWorkspaceProfile(workspaceId: string, profileId: string): Promise<void> {
  const docRef = workspacesCol().doc(workspaceId).collection('profiles').doc(profileId);
  await docRef.delete();
}

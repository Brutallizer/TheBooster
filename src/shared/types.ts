// ============================================
// Shared Types for MultiAccount Manager
// ============================================

export interface FingerprintConfig {
  // Browser Identity
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];

  // Hardware Fingerprinting
  canvas: {
    noise: string;
    webglVendor: string;
    webglRenderer: string;
  };

  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };

  audio: {
    fingerprint: string;
  };

  fonts: string[];
  timezone: string;

  // WebRTC
  webRTC: {
    publicIP: string;
    privateIP: string;
  };

  // Device metadata
  deviceMemory: number;
  hardwareConcurrency: number;
}

export interface Profile {
  id: string;
  name: string;
  fingerprint_config: FingerprintConfig;
  proxy_id: string | null;
  cookies_path: string;
  storage_path: string;
  created_at: number;
  last_used: number | null;
  account_type: 'free' | 'premium';
  notes: string;
}

export interface Proxy {
  id: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  proxy_type: 'http' | 'https' | 'socks5';
  country: string | null;
  is_active: boolean;
}

export interface Session {
  id: string;
  profile_id: string;
  login_timestamp: number;
  logout_timestamp: number | null;
  cookies_snapshot: string | null;
}

// Sync Status
export interface SyncStatus {
  status: 'idle' | 'syncing' | 'synced' | 'failed' | 'offline';
  lastSyncedAt: number | null;
  pendingCount: number;
}

// Workspace Types
export interface WorkspaceMember {
  uid: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: number;
}

export interface WorkspaceData {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  members: WorkspaceMember[];
  createdAt: number;
}

// Analytics Types
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

// Automation
export interface ScriptExecutionResult {
  success: boolean;
  logs: string[];
  error?: string;
  returnValue?: any;
}

// IPC Channel Types
export interface ElectronAPI {
  profiles: {
    list: () => Promise<any>;
    create: (data: CreateProfileData) => Promise<Profile>;
    open: (id: string) => Promise<{ success: boolean; error?: string }>;
    close: (id: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
    update: (id: string, data: Partial<CreateProfileData>) => Promise<Profile>;
    // Cloud Sync
    sync: () => Promise<{ success: boolean; uploaded?: number; downloaded?: number; conflicts?: number; error?: string }>;
    syncStatus: () => Promise<SyncStatus>;
    importCloud: () => Promise<{ success: boolean; imported?: number; total?: number; error?: string }>;
    retryPending: () => Promise<{ success: boolean; processed?: number; error?: string }>;
  };
  proxies: {
    list: () => Promise<Proxy[]>;
    create: (data: CreateProxyData) => Promise<Proxy>;
    delete: (id: string) => Promise<void>;
    test: (id: string) => Promise<{ success: boolean; ip?: string; latency?: number; error?: string }>;
    // Advanced Proxy
    import: (content: string) => Promise<{ success: boolean; imported?: number; failed?: number; error?: string }>;
    export: () => Promise<{ success: boolean; content?: string; error?: string }>;
    testAll: () => Promise<{ success: boolean; results?: Array<{ id: string; success: boolean; latency?: number; error?: string }>; error?: string }>;
  };
  auth: {
    verifyToken: (idToken: string) => Promise<{ success: boolean; tier?: string; error?: string; offline?: boolean }>;
    logout: () => Promise<{ success: boolean }>;
    status: () => Promise<{ loggedIn: boolean; uid?: string; email?: string; tier?: string }>;
  };
  app: {
    getVersion: () => Promise<string>;
    getProfilesPath: () => Promise<string>;
  };
  workspace: {
    list: () => Promise<WorkspaceData[]>;
    create: (name: string) => Promise<{ success: boolean; workspace?: WorkspaceData; error?: string }>;
    invite: (workspaceId: string, email: string, role: string) => Promise<{ success: boolean; error?: string }>;
    removeMember: (workspaceId: string, targetUid: string) => Promise<{ success: boolean; error?: string }>;
    delete: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
    setActive: (workspaceId: string | null) => Promise<{ success: boolean }>;
    getActive: () => Promise<{ workspaceId: string | null }>;
    lockProfile: (profileId: string, uid: string, email: string) => Promise<{ success: boolean; lockedBy?: string }>;
    unlockProfile: (profileId: string, uid: string) => Promise<{ success: boolean }>;
  };
  analytics: {
    getLogs: (workspaceId: string, limit?: number) => Promise<SessionLog[]>;
  };
  automation: {
    run: (profileId: string, scriptCode: string) => Promise<ScriptExecutionResult>;
  };
}

export interface CreateProfileData {
  name: string;
  proxy_id?: string | null;
  account_type?: 'free' | 'premium';
  notes?: string;
}

export interface CreateProxyData {
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  proxy_type?: 'http' | 'https' | 'socks5';
  country?: string | null;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// ============================================
// Preload Script (contextBridge)
// ============================================
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    create: (data: any) => ipcRenderer.invoke('profiles:create', data),
    open: (id: string) => ipcRenderer.invoke('profiles:open', id),
    close: (id: string) => ipcRenderer.invoke('profiles:close', id),
    delete: (id: string) => ipcRenderer.invoke('profiles:delete', id),
    update: (id: string, data: any) => ipcRenderer.invoke('profiles:update', id, data),
    // Cloud Sync
    sync: () => ipcRenderer.invoke('profiles:sync'),
    syncStatus: () => ipcRenderer.invoke('profiles:sync-status'),
    importCloud: () => ipcRenderer.invoke('profiles:import-cloud'),
    retryPending: () => ipcRenderer.invoke('profiles:retry-pending'),
  },
  proxies: {
    list: () => ipcRenderer.invoke('proxies:list'),
    create: (data: any) => ipcRenderer.invoke('proxies:create', data),
    delete: (id: string) => ipcRenderer.invoke('proxies:delete', id),
    test: (id: string) => ipcRenderer.invoke('proxies:test', id),
    // Advanced Proxy
    import: (content: string) => ipcRenderer.invoke('proxies:import', content),
    export: () => ipcRenderer.invoke('proxies:export'),
    testAll: () => ipcRenderer.invoke('proxies:test-all'),
  },
  auth: {
    verifyToken: (idToken: string) => ipcRenderer.invoke('auth:verify', idToken),
    logout: () => ipcRenderer.invoke('auth:logout'),
    status: () => ipcRenderer.invoke('auth:status'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    getProfilesPath: () => ipcRenderer.invoke('app:profilesPath'),
  },
  workspace: {
    list: () => ipcRenderer.invoke('workspace:list'),
    create: (name: string) => ipcRenderer.invoke('workspace:create', name),
    invite: (workspaceId: string, email: string, role: string) => ipcRenderer.invoke('workspace:invite', workspaceId, email, role),
    removeMember: (workspaceId: string, targetUid: string) => ipcRenderer.invoke('workspace:remove-member', workspaceId, targetUid),
    delete: (workspaceId: string) => ipcRenderer.invoke('workspace:delete', workspaceId),
    setActive: (workspaceId: string | null) => ipcRenderer.invoke('workspace:set-active', workspaceId),
    getActive: () => ipcRenderer.invoke('workspace:get-active'),
    lockProfile: (profileId: string, uid: string, email: string) => ipcRenderer.invoke('workspace:lock-profile', profileId, uid, email),
    unlockProfile: (profileId: string, uid: string) => ipcRenderer.invoke('workspace:unlock-profile', profileId, uid),
  },
  analytics: {
    getLogs: (workspaceId: string, limit?: number) => ipcRenderer.invoke('analytics:get-logs', workspaceId, limit),
  },
  automation: {
    run: (profileId: string, scriptCode: string) => ipcRenderer.invoke('automation:run', profileId, scriptCode),
  },
});

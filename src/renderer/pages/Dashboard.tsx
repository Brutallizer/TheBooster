import React, { useState, useEffect, useCallback } from 'react';
import ProfileCard from '../components/ProfileCard';
import CreateProfileModal from '../components/CreateProfileModal';
import AutomationStudio from '../pages/AutomationStudio';
import Toast, { ToastMessage } from '../components/Toast';

interface ProfileWithStatus {
  id: string;
  name: string;
  fingerprint_config: any;
  proxy_id: string | null;
  cookies_path: string;
  storage_path: string;
  created_at: number;
  last_used: number | null;
  account_type: 'free' | 'premium';
  notes: string;
  is_running?: boolean;
}

const Dashboard: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [openingProfile, setOpeningProfile] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [profileLimit, setProfileLimit] = useState<number | null>(null);
  const [tier, setTier] = useState<string>('free');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isWorkspace, setIsWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [editingScriptForProfile, setEditingScriptForProfile] = useState<{id: string, name: string} | null>(null);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const fetchProfiles = useCallback(async () => {
    try {
      const result = await window.electronAPI.profiles.list() as any;
      setProfiles(result.profiles || result);
      if (result.limit !== undefined) setProfileLimit(result.limit);
      if (result.tier) setTier(result.tier);
      if (result.syncStatus) {
        setSyncStatus(result.syncStatus.status);
        setLastSynced(result.syncStatus.lastSyncedAt);
        setPendingCount(result.syncStatus.pendingCount);
      }
      setIsWorkspace(!!result.isWorkspace);
      if (result.isWorkspace) {
        const activeRes = await window.electronAPI.workspace.getActive();
        if (activeRes.workspaceId) {
          const list = await window.electronAPI.workspace.list();
          const ws = list.find(w => w.id === activeRes.workspaceId);
          setWorkspaceName(ws?.name || null);
        }
      } else {
        setWorkspaceName(null);
      }
    } catch (err) {
      addToast('error', 'Gagal memuat profil');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchProfiles();
    const interval = setInterval(fetchProfiles, 3000);
    return () => clearInterval(interval);
  }, [fetchProfiles]);

  const handleCreateProfile = async (data: { name: string; account_type: 'free' | 'premium'; notes: string }) => {
    try {
      await window.electronAPI.profiles.create(data);
      addToast('success', `Profil "${data.name}" berhasil dibuat!`);
      setShowCreateModal(false);
      fetchProfiles();
    } catch (err: any) {
      const msg = err?.message || 'Gagal membuat profil';
      addToast('error', msg);
    }
  };

  const handleOpenProfile = async (id: string) => {
    setOpeningProfile(id);
    try {
      const result = await window.electronAPI.profiles.open(id);
      if (result.success) {
        addToast('success', 'Browser berhasil diluncurkan!');
      } else {
        addToast('error', result.error || 'Gagal membuka profil');
      }
    } catch (err) {
      addToast('error', 'Gagal membuka profil');
    } finally {
      setOpeningProfile(null);
      fetchProfiles();
    }
  };

  const handleCloseProfile = async (id: string) => {
    try {
      await window.electronAPI.profiles.close(id);
      addToast('info', 'Browser ditutup');
      fetchProfiles();
    } catch (err) {
      addToast('error', 'Gagal menutup browser');
    }
  };

  const handleDeleteProfile = async (id: string, name: string) => {
    if (!confirm(`Yakin ingin menghapus profil "${name}"? Semua data (cookies, cache) akan dihapus permanen.`)) {
      return;
    }
    try {
      await window.electronAPI.profiles.delete(id);
      addToast('success', `Profil "${name}" dihapus`);
      fetchProfiles();
    } catch (err) {
      addToast('error', 'Gagal menghapus profil');
    }
  };

  // ---- Cloud Sync Handlers ----

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await window.electronAPI.profiles.sync();
      if (result.success) {
        addToast('success', `☁️ Sync selesai! ${result.uploaded} di-upload, ${result.downloaded} tersedia di cloud.`);
      } else {
        addToast('error', result.error || 'Sync gagal');
      }
      fetchProfiles();
    } catch (err: any) {
      addToast('error', err?.message || 'Sync gagal');
    } finally {
      setSyncing(false);
    }
  };

  const handleImportCloud = async () => {
    setSyncing(true);
    try {
      const result = await window.electronAPI.profiles.importCloud();
      if (result.success) {
        addToast('success', `☁️ Berhasil import ${result.imported} profil dari cloud!`);
        fetchProfiles();
      } else {
        addToast('error', result.error || 'Import gagal');
      }
    } catch (err: any) {
      addToast('error', err?.message || 'Import gagal');
    } finally {
      setSyncing(false);
    }
  };

  // Sync status display
  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'syncing': return '🔄';
      case 'synced': return '☁️';
      case 'failed': return '⚠️';
      case 'offline': return '📴';
      default: return '☁️';
    }
  };

  const formatLastSynced = () => {
    if (!lastSynced) return null;
    const diff = Math.floor((Date.now() - lastSynced) / 1000);
    if (diff < 60) return 'baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    return `${Math.floor(diff / 3600)} jam lalu`;
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <span>Memuat profil...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isWorkspace ? `🏢 Workspace: ${workspaceName}` : 'Dashboard'}
          </h1>
          <p className="page-subtitle">
            {profiles.length}{profileLimit ? `/${profileLimit}` : ''} profil • {profiles.filter(p => p.is_running).length} aktif
            {tier === 'free' && !isWorkspace && <span style={{ marginLeft: 8, color: 'var(--accent-warning)', fontSize: 11 }}>Free Plan</span>}
            {isWorkspace && <span style={{ marginLeft: 8, color: 'var(--accent-primary)', fontSize: 11 }}>Cloud Shared</span>}
          </p>
        </div>
        <div className="page-header-actions">
          {/* Cloud Sync buttons (Personal Premium only) */}
          {tier === 'premium' && !isWorkspace && (
            <div className="sync-controls">
              <button
                className={`btn btn-secondary btn-sm sync-btn ${syncStatus}`}
                onClick={handleSync}
                disabled={syncing}
                title={lastSynced ? `Last sync: ${formatLastSynced()}` : 'Belum pernah sync'}
              >
                <span className={syncing ? 'spin-icon' : ''}>{getSyncIcon()}</span>
                {syncing ? 'Syncing...' : 'Sync'}
                {pendingCount > 0 && <span className="sync-badge">{pendingCount}</span>}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleImportCloud}
                disabled={syncing}
                title="Import profil dari cloud"
              >
                ⬇️ Import Cloud
              </button>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            ➕ {isWorkspace ? 'Buat Profil Bersama' : 'Buat Profil'}
          </button>
        </div>
      </div>

      {/* Sync status bar */}
      {tier === 'premium' && !isWorkspace && lastSynced && (
        <div className="sync-status-bar">
          <span className="sync-status-dot" data-status={syncStatus} />
          <span>Sync: {syncStatus === 'synced' ? '✓' : syncStatus} • Terakhir: {formatLastSynced()}</span>
          {pendingCount > 0 && <span className="sync-pending"> • {pendingCount} pending</span>}
        </div>
      )}

      {profiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎭</div>
          <h3 className="empty-state-title">Belum ada profil</h3>
          <p className="empty-state-text">Buat profil pertama untuk mulai mengelola akun media sosial.</p>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            Buat Profil Pertama
          </button>
          {tier === 'premium' && (
            <button className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={handleImportCloud}>
              ⬇️ Import dari Cloud
            </button>
          )}
        </div>
      ) : (
        <div className="profile-grid">
          {profiles.map(profile => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isOpening={openingProfile === profile.id}
              onOpen={() => handleOpenProfile(profile.id)}
              onClose={() => handleCloseProfile(profile.id)}
              onDelete={() => handleDeleteProfile(profile.id, profile.name)}
              onRunScript={() => setEditingScriptForProfile({ id: profile.id, name: profile.name })}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateProfileModal
          onSubmit={handleCreateProfile}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editingScriptForProfile && (
        <AutomationStudio 
          profileId={editingScriptForProfile.id}
          profileName={editingScriptForProfile.name}
          onClose={() => setEditingScriptForProfile(null)}
        />
      )}

      <Toast messages={toasts} />
    </>
  );
};

export default Dashboard;

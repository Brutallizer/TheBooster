import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Toast, { ToastMessage } from '../components/Toast';

interface WorkspaceMember {
  uid: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: number;
}

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  members: WorkspaceMember[];
  createdAt: number;
}

const WorkspaceManager: React.FC = () => {
  const { user, isPremium } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const data = await window.electronAPI.workspace.list();
      setWorkspaces(data);
      const active = await window.electronAPI.workspace.getActive();
      setActiveWsId(active.workspaceId);
    } catch (err) {
      addToast('error', 'Gagal memuat workspaces');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const result = await window.electronAPI.workspace.create(newName.trim());
      if (result.success) {
        addToast('success', `Workspace "${newName}" berhasil dibuat!`);
        setShowCreateModal(false);
        setNewName('');
        fetchWorkspaces();
      } else {
        addToast('error', result.error || 'Gagal membuat workspace');
      }
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal membuat workspace');
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !showInviteModal) return;
    try {
      const result = await window.electronAPI.workspace.invite(showInviteModal, inviteEmail.trim(), inviteRole);
      if (result.success) {
        addToast('success', `✉️ ${inviteEmail} diundang sebagai ${inviteRole}!`);
        setShowInviteModal(null);
        setInviteEmail('');
        fetchWorkspaces();
      } else {
        addToast('error', result.error || 'Gagal mengundang');
      }
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal mengundang');
    }
  };

  const handleRemoveMember = async (workspaceId: string, targetUid: string, email: string) => {
    if (!confirm(`Keluarkan ${email} dari workspace?`)) return;
    try {
      const result = await window.electronAPI.workspace.removeMember(workspaceId, targetUid);
      if (result.success) {
        addToast('success', `${email} telah dikeluarkan`);
        fetchWorkspaces();
      } else {
        addToast('error', result.error || 'Gagal');
      }
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal');
    }
  };

  const handleDeleteWorkspace = async (ws: Workspace) => {
    if (!confirm(`Yakin ingin menghapus workspace "${ws.name}"? Semua data akan hilang.`)) return;
    try {
      const result = await window.electronAPI.workspace.delete(ws.id);
      if (result.success) {
        addToast('success', `Workspace "${ws.name}" dihapus`);
        fetchWorkspaces();
      } else {
        addToast('error', result.error || 'Gagal');
      }
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal');
    }
  };

  const handleSetActive = async (wsId: string | null) => {
    await window.electronAPI.workspace.setActive(wsId);
    setActiveWsId(wsId);
    addToast('info', wsId ? 'Workspace berubah' : 'Kembali ke Personal');
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'badge-premium';
      case 'member': return 'badge-free';
      default: return 'badge-viewer';
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <span>Memuat workspaces...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Workspaces</h1>
          <p className="page-subtitle">
            {workspaces.length} workspace • Kolaborasi tim Anda
          </p>
        </div>
        <div className="page-header-actions">
          {isPremium && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              ➕ Buat Workspace
            </button>
          )}
        </div>
      </div>

      {!isPremium && (
        <div className="upgrade-card" style={{ marginBottom: 20 }}>
          <div className="upgrade-card-content">
            <div className="upgrade-card-icon">👑</div>
            <div>
              <h3 className="upgrade-card-title">Fitur Premium</h3>
              <p className="upgrade-card-desc">
                Upgrade ke Premium untuk membuat workspace dan berkolaborasi dengan tim.
              </p>
            </div>
          </div>
        </div>
      )}

      {workspaces.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <h3 className="empty-state-title">Belum ada workspace</h3>
          <p className="empty-state-text">
            Buat workspace untuk berkolaborasi dengan tim Anda. Berbagi profil browser secara aman.
          </p>
          {isPremium && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              Buat Workspace Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="workspace-grid">
          {workspaces.map(ws => (
            <div
              key={ws.id}
              className={`workspace-card ${activeWsId === ws.id ? 'workspace-active' : ''}`}
            >
              <div className="workspace-card-header">
                <h3 className="workspace-card-title">{ws.name}</h3>
                {activeWsId === ws.id ? (
                  <span className="profile-card-badge badge-premium">ACTIVE</span>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSetActive(ws.id)}>
                    Aktifkan
                  </button>
                )}
              </div>

              <div className="workspace-members">
                <p className="workspace-members-title">
                  👥 {ws.members.length} Anggota
                </p>
                {ws.members.map(m => (
                  <div key={m.uid} className="workspace-member-row">
                    <span className="workspace-member-email">{m.email}</span>
                    <span className={`profile-card-badge ${getRoleBadgeClass(m.role)}`}>
                      {m.role}
                    </span>
                    {ws.ownerId === user?.uid && m.uid !== user?.uid && (
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '2px 8px', fontSize: 10 }}
                        onClick={() => handleRemoveMember(ws.id, m.uid, m.email)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="workspace-card-actions">
                {ws.ownerId === user?.uid && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowInviteModal(ws.id)}>
                      ✉️ Undang
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteWorkspace(ws)}>
                      🗑️ Hapus
                    </button>
                  </>
                )}
                {activeWsId === ws.id && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSetActive(null)}>
                    ← Personal
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Buat Workspace</h2>
            <div className="form-group">
              <label className="form-label">Nama Workspace</label>
              <input
                className="form-input"
                type="text"
                placeholder="Contoh: Tim Marketing"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => { setShowCreateModal(false); setNewName(''); }}>Batal</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>Buat</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">✉️ Undang Anggota</h2>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="anggota@email.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}>
                <option value="member">Member — bisa buka & edit profil</option>
                <option value="viewer">Viewer — hanya bisa melihat & buka profil</option>
              </select>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => { setShowInviteModal(null); setInviteEmail(''); }}>Batal</button>
              <button className="btn btn-primary" onClick={handleInvite} disabled={!inviteEmail.trim()}>Undang</button>
            </div>
          </div>
        </div>
      )}

      <Toast messages={toasts} />
    </>
  );
};

export default WorkspaceManager;

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { SessionLog } from '../../shared/types';
import Toast, { ToastMessage } from '../components/Toast';

const Analytics: React.FC = () => {
  const { isPremium } = useAuth();
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const active = await window.electronAPI.workspace.getActive();
      setActiveWsId(active.workspaceId);

      if (active.workspaceId) {
        const data = await window.electronAPI.analytics.getLogs(active.workspaceId, 100);
        setLogs(data);
      } else {
        setLogs([]);
      }
    } catch (err) {
      addToast('error', 'Gagal memuat activity log');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    const m2 = m % 60;
    return `${h}h ${m2}m`;
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(ts));
  };

  if (!isPremium) {
    return (
      <div className="empty-state" style={{ marginTop: 40 }}>
        <div className="empty-state-icon">👑</div>
        <h3 className="empty-state-title">Fitur Premium</h3>
        <p className="empty-state-text">
          Analytics & Activity Log hanya tersedia untuk pengguna Premium di dalam Workspace.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <span>Memuat data analitik...</span>
      </div>
    );
  }

  if (!activeWsId) {
    return (
      <div className="empty-state" style={{ marginTop: 40 }}>
        <div className="empty-state-icon">🏢</div>
        <h3 className="empty-state-title">Workspace Tidak Aktif</h3>
        <p className="empty-state-text">
          Pilih atau aktifkan workspace terlebih dahulu di halaman Workspaces untuk melihat analitik tim.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & Activity Log</h1>
          <p className="page-subtitle">
            Memantau eksekusi profil dan durasi sesi anggota tim
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchLogs}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="workspace-grid" style={{ marginBottom: 24 }}>
        <div className="workspace-card" style={{ flex: 1 }}>
          <h3 className="workspace-card-title">Total Sesi (All Time)</h3>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8, color: 'var(--accent-primary)' }}>
            {logs.length}
          </div>
        </div>
        <div className="workspace-card" style={{ flex: 1 }}>
          <h3 className="workspace-card-title">Total Durasi Aktivitas</h3>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8, color: 'var(--accent-secondary)' }}>
            {formatDuration(logs.reduce((acc, l) => acc + l.durationSeconds, 0))}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', padding: 4 }}>
        <table className="proxy-table">
          <thead>
            <tr>
              <th>Waktu Terekam</th>
              <th>Profil</th>
              <th>Anggota Tim (Email)</th>
              <th>Durasi Sesi</th>
              <th>Proxy Digunakan</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  Belum ada log aktivitas yang tercatat. Buka dan tutup profil untuk merekam sesi.
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>{formatDate(log.endTime)}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{log.profileName}</td>
                  <td>
                    <span className="profile-card-badge badge-free" style={{ textTransform: 'none' }}>
                      {log.email}
                    </span>
                  </td>
                  <td style={{ color: 'var(--accent-success)', fontFamily: 'monospace' }}>
                    {formatDuration(log.durationSeconds)}
                  </td>
                  <td>
                    {log.proxyHost ? (
                      <code>{log.proxyHost}</code>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Direct (No Proxy)</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Toast messages={toasts} />
    </>
  );
};

export default Analytics;

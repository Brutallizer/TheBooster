import React from 'react';

interface ProfileWithStatus {
  id: string;
  name: string;
  fingerprint_config: any;
  proxy_id: string | null;
  created_at: number;
  last_used: number | null;
  account_type: 'free' | 'premium';
  notes: string;
  is_running?: boolean;
}

interface ProfileCardProps {
  profile: ProfileWithStatus;
  isOpening: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onRunScript?: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile, isOpening, onOpen, onClose, onDelete, onRunScript }) => {
  const fp = profile.fingerprint_config;
  const platformIcon = fp.platform === 'Win32' ? '🪟' : fp.platform === 'MacIntel' ? '🍎' : '🐧';
  const lastUsed = profile.last_used
    ? new Date(profile.last_used).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Belum pernah';

  return (
    <div className="profile-card">
      <div className="profile-card-header">
        <span className="profile-card-name">{profile.name}</span>
        <span className={`profile-card-badge ${profile.account_type === 'premium' ? 'badge-premium' : 'badge-free'}`}>
          {profile.account_type}
        </span>
      </div>

      <div className="profile-card-meta">
        <div className="profile-card-meta-item">
          <span className="profile-card-meta-icon">{platformIcon}</span>
          <span>{fp.platform} • {fp.screen.width}×{fp.screen.height}</span>
        </div>
        <div className="profile-card-meta-item">
          <span className="profile-card-meta-icon">🌍</span>
          <span>{fp.timezone}</span>
        </div>
        <div className="profile-card-meta-item">
          <span className="profile-card-meta-icon">🕐</span>
          <span>{lastUsed}</span>
        </div>
        {profile.proxy_id && (
          <div className="profile-card-meta-item">
            <span className="profile-card-meta-icon">🛡️</span>
            <span>Proxy attached</span>
          </div>
        )}
      </div>

      <div className={`profile-card-status ${profile.is_running ? 'status-running' : 'status-stopped'}`}>
        <span className="status-dot" />
        <span>{profile.is_running ? 'Running' : 'Stopped'}</span>
      </div>

      <div className="profile-card-actions">
        {profile.is_running ? (
          <>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={onClose}>
              ⏹ Stop
            </button>
            {onRunScript && (
              <button 
                className="btn btn-primary btn-sm" 
                style={{ flex: 1, padding: '4px 8px', background: 'var(--accent-primary)', color: '#000' }} 
                onClick={onRunScript}
                title="Run Automation Script"
              >
                ⚡ Script
              </button>
            )}
          </>
        ) : (
          <button
            className="btn btn-success btn-sm btn-flex"
            onClick={onOpen}
            disabled={isOpening}
          >
            {isOpening ? (
              <><div className="loading-spinner" style={{ width: 12, height: 12 }} /> Opening...</>
            ) : '▶ Launch'}
          </button>
        )}
        <button
          className="btn btn-danger btn-sm"
          onClick={onDelete}
          disabled={profile.is_running}
          title={profile.is_running ? 'Stop browser dulu sebelum menghapus' : 'Hapus profil'}
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default ProfileCard;

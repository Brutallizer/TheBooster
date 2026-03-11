import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const LEMON_SQUEEZY_CHECKOUT_URL = 'https://multiaccount.lemonsqueezy.com/checkout'; // Placeholder

const Settings: React.FC = () => {
  const { user, tier, isPremium } = useAuth();
  const [version, setVersion] = useState('...');
  const [profilesPath, setProfilesPath] = useState('...');

  useEffect(() => {
    window.electronAPI.app.getVersion().then(setVersion).catch(() => {});
    window.electronAPI.app.getProfilesPath().then(setProfilesPath).catch(() => {});
  }, []);

  const handleUpgrade = () => {
    // Open LemonSqueezy checkout in external browser
    const checkoutUrl = `${LEMON_SQUEEZY_CHECKOUT_URL}?checkout[email]=${encodeURIComponent(user?.email || '')}`;
    window.open(checkoutUrl, '_blank');
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Konfigurasi aplikasi</p>
        </div>
      </div>

      {/* Premium Upgrade Card */}
      {!isPremium && (
        <div className="upgrade-card">
          <div className="upgrade-card-content">
            <div className="upgrade-card-icon">👑</div>
            <div>
              <h3 className="upgrade-card-title">Upgrade ke Premium</h3>
              <p className="upgrade-card-desc">
                Unlock semua fitur: profil unlimited, cloud sync, dan priority support.
              </p>
            </div>
          </div>
          <div className="upgrade-features">
            <div className="upgrade-feature">✅ Profil Unlimited</div>
            <div className="upgrade-feature">☁️ Cloud Sync & Backup</div>
            <div className="upgrade-feature">🔄 Multi-Device Sync</div>
            <div className="upgrade-feature">⚡ Priority Support</div>
          </div>
          <button className="btn btn-primary upgrade-btn" onClick={handleUpgrade}>
            👑 Upgrade Sekarang
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            Pembayaran aman via LemonSqueezy. Bisa batal kapan saja.
          </p>
        </div>
      )}

      {/* Premium Status */}
      {isPremium && (
        <div className="settings-section" style={{ borderColor: 'rgba(139, 92, 246, 0.3)', background: 'rgba(139, 92, 246, 0.05)' }}>
          <h3 className="settings-section-title">👑 Status Premium</h3>
          <div className="settings-row">
            <span className="settings-label">Tier</span>
            <span className="profile-card-badge badge-premium">PREMIUM</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Email</span>
            <span className="settings-value">{user?.email}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Profil</span>
            <span style={{ color: 'var(--accent-success)', fontSize: 13 }}>♾️ Unlimited</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Cloud Sync</span>
            <span style={{ color: 'var(--accent-success)', fontSize: 13 }}>✅ Aktif</span>
          </div>
        </div>
      )}

      {/* Application Info */}
      <div className="settings-section">
        <h3 className="settings-section-title">📦 Informasi Aplikasi</h3>
        <div className="settings-row">
          <span className="settings-label">Versi</span>
          <span className="settings-value">{version}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Profile Data Path</span>
          <span className="settings-value" style={{ fontSize: 11, maxWidth: 400, wordBreak: 'break-all' }}>{profilesPath}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Akun</span>
          <span className="settings-value">{user?.email || '—'}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Tier</span>
          <span className={`profile-card-badge ${isPremium ? 'badge-premium' : 'badge-free'}`}>{tier}</span>
        </div>
      </div>

      {/* Fingerprint Info */}
      <div className="settings-section">
        <h3 className="settings-section-title">🧠 Anti-Detection Engine</h3>
        <div className="settings-row">
          <span className="settings-label">Stealth Plugin</span>
          <span style={{ color: 'var(--accent-success)', fontSize: 13 }}>✅ Active</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Canvas Noise</span>
          <span style={{ color: 'var(--accent-success)', fontSize: 13 }}>✅ Active</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">WebGL Spoofing</span>
          <span style={{ color: 'var(--accent-success)', fontSize: 13 }}>✅ Active</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Audio Spoofing</span>
          <span style={{ color: 'var(--accent-success)', fontSize: 13 }}>✅ Active</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Timezone Override</span>
          <span style={{ color: 'var(--accent-success)', fontSize: 13 }}>✅ Active</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">WebRTC Leak Prevention</span>
          <span style={{ color: 'var(--accent-success)', fontSize: 13 }}>✅ Active</span>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="settings-section" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
        <h3 className="settings-section-title">⚠️ Disclaimer</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Aplikasi ini dirancang untuk pengelolaan multi-akun yang sah oleh marketer, content creator, dan agensi.
          Pengguna bertanggung jawab penuh atas penggunaan akun mereka.
          Kami menyarankan untuk melakukan "warm-up" terlebih dahulu dan tidak melakukan aktivitas spam.
          Penggunaan yang melanggar ketentuan layanan platform pihak ketiga adalah risiko pengguna sendiri.
        </p>
      </div>
    </>
  );
};

export default Settings;

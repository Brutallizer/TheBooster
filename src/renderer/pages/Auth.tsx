// ============================================
// Auth Page (Login / Register)
// ============================================
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const AuthPage: React.FC = () => {
  const { login, register, error, loading, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const switchMode = () => {
    setMode(prev => (prev === 'login' ? 'register' : 'login'));
    setLocalError('');
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!email.trim() || !password.trim()) {
      setLocalError('Email dan password wajib diisi.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setLocalError('Password minimal 6 karakter.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Konfirmasi password tidak cocok.');
        return;
      }
    }

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch {
      // Error handled by AuthContext
    }
  };

  const displayError = localError || error;

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Branding */}
        <div className="auth-brand">
          <div className="auth-brand-icon">M</div>
          <h1 className="auth-brand-title">MultiAccount Manager</h1>
          <p className="auth-brand-subtitle">
            {mode === 'login' ? 'Masuk ke akun Anda' : 'Buat akun baru'}
          </p>
        </div>

        {/* Error Display */}
        {displayError && (
          <div className="auth-error">
            ❌ {displayError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="email@contoh.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Konfirmasi Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading ? (
              <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Memproses...</>
            ) : mode === 'login' ? '🔐 Masuk' : '✨ Daftar'}
          </button>
        </form>

        {/* Switch Mode */}
        <div className="auth-switch">
          <span className="auth-switch-text">
            {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
          </span>
          <button className="auth-switch-btn" onClick={switchMode}>
            {mode === 'login' ? 'Daftar Sekarang' : 'Masuk'}
          </button>
        </div>

        {/* Footer */}
        <div className="auth-footer">
          <span>🎭 Kelola multi-akun dengan aman</span>
          <span>🧠 Anti-detection fingerprint</span>
          <span>🌐 Proxy integration</span>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

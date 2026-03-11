import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/Auth';
import Dashboard from './pages/Dashboard';
import ProxyManager from './pages/ProxyManager';
import WorkspaceManager from './pages/WorkspaceManager';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

type Page = 'dashboard' | 'proxies' | 'workspaces' | 'analytics' | 'settings';

const AppContent: React.FC = () => {
  const { user, loading, tier, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  // Loading state
  if (loading) {
    return (
      <div className="auth-container">
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Memuat...</p>
        </div>
      </div>
    );
  }

  // Not authenticated → show login
  if (!user) {
    return <AuthPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'proxies': return <ProxyManager />;
      case 'workspaces': return <WorkspaceManager />;
      case 'analytics': return <Analytics />;
      case 'settings': return <Settings />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">M</div>
          <div className="sidebar-brand-text">MultiAccount</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-link ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            <span className="sidebar-link-icon">📊</span>
            <span>Dashboard</span>
          </button>
          <button
            className={`sidebar-link ${currentPage === 'proxies' ? 'active' : ''}`}
            onClick={() => setCurrentPage('proxies')}
          >
            <span className="sidebar-link-icon">🌐</span>
            <span>Proxy Manager</span>
          </button>
          <button
            className={`sidebar-link ${currentPage === 'workspaces' ? 'active' : ''}`}
            onClick={() => setCurrentPage('workspaces')}
          >
            <span className="sidebar-link-icon">👥</span>
            <span>Workspaces</span>
          </button>
          <button
            className={`sidebar-link ${currentPage === 'analytics' ? 'active' : ''}`}
            onClick={() => setCurrentPage('analytics')}
          >
            <span className="sidebar-link-icon">📊</span>
            <span>Analytics</span>
          </button>
          <button
            className={`sidebar-link ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentPage('settings')}
          >
            <span className="sidebar-link-icon">⚙️</span>
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          {/* User Info */}
          <div className="sidebar-user">
            <div className="sidebar-user-email" title={user.email || ''}>
              {user.email}
            </div>
            <div className="sidebar-user-tier">
              <span className={`profile-card-badge ${tier === 'premium' ? 'badge-premium' : 'badge-free'}`}>
                {tier}
              </span>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={logout}>
            🚪 Logout
          </button>
          <div className="sidebar-stats" style={{ marginTop: 8 }}>
            <span>MultiAccount Manager v1.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;

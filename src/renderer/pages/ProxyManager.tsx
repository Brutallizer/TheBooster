import React, { useState, useEffect, useCallback, useRef } from 'react';
import Toast, { ToastMessage } from '../components/Toast';

interface Proxy {
  id: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  proxy_type: 'http' | 'https' | 'socks5';
  country: string | null;
  is_active: boolean;
}

interface TestResult {
  id: string;
  host: string;
  success: boolean;
  latency?: number;
  error?: string;
}

const ProxyManager: React.FC = () => {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [testingProxy, setTestingProxy] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(new Map());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedProxies, setSelectedProxies] = useState<Set<string>>(new Set());
  const [importText, setImportText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formType, setFormType] = useState<'http' | 'https' | 'socks5'>('http');
  const [formCountry, setFormCountry] = useState('');

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const fetchProxies = useCallback(async () => {
    try {
      const data = await window.electronAPI.proxies.list();
      setProxies(data);
    } catch (err) {
      addToast('error', 'Gagal memuat proxy');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchProxies();
  }, [fetchProxies]);

  const handleAddProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHost || !formPort) return;

    try {
      await window.electronAPI.proxies.create({
        host: formHost,
        port: parseInt(formPort),
        username: formUsername || null,
        password: formPassword || null,
        proxy_type: formType,
        country: formCountry || null,
      });
      addToast('success', 'Proxy berhasil ditambahkan!');
      setShowAddForm(false);
      resetForm();
      fetchProxies();
    } catch (err) {
      addToast('error', 'Gagal menambahkan proxy');
    }
  };

  const handleDeleteProxy = async (id: string) => {
    if (!confirm('Yakin ingin menghapus proxy ini?')) return;
    try {
      await window.electronAPI.proxies.delete(id);
      addToast('success', 'Proxy dihapus');
      setSelectedProxies(prev => { prev.delete(id); return new Set(prev); });
      fetchProxies();
    } catch (err) {
      addToast('error', 'Gagal menghapus proxy');
    }
  };

  const handleTestProxy = async (id: string) => {
    setTestingProxy(id);
    try {
      const result = await window.electronAPI.proxies.test(id);
      if (result.success) {
        addToast('success', `Proxy aktif! Latency: ${result.latency}ms`);
      } else {
        addToast('error', `Proxy gagal: ${result.error}`);
      }
    } catch (err) {
      addToast('error', 'Gagal menguji proxy');
    } finally {
      setTestingProxy(null);
    }
  };

  // ---- Advanced: Import ----
  const handleImport = async () => {
    if (!importText.trim()) return;
    try {
      const result = await window.electronAPI.proxies.import(importText);
      if (result.success) {
        addToast('success', `✅ Import selesai! ${result.imported} berhasil, ${result.failed} gagal.`);
        setShowImportModal(false);
        setImportText('');
        fetchProxies();
      } else {
        addToast('error', result.error || 'Import gagal');
      }
    } catch (err: any) {
      addToast('error', err?.message || 'Import gagal');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText(ev.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  // ---- Advanced: Export ----
  const handleExport = async () => {
    try {
      const result = await window.electronAPI.proxies.export();
      if (result.success && result.content) {
        // Create blob and download
        const blob = new Blob([result.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `proxies_export_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        addToast('success', `📁 ${proxies.length} proxy diekspor!`);
      }
    } catch (err) {
      addToast('error', 'Export gagal');
    }
  };

  // ---- Advanced: Test All ----
  const handleTestAll = async () => {
    setTestingAll(true);
    setTestResults(new Map());
    try {
      const result = await window.electronAPI.proxies.testAll();
      if (result.success && result.results) {
        const map = new Map<string, TestResult>();
        for (const r of result.results) {
          map.set(r.id, { id: r.id, host: (r as any).host || '', success: r.success, latency: r.latency, error: r.error });
        }
        setTestResults(map);
        const passed = result.results.filter(r => r.success).length;
        addToast('success', `Test selesai! ${passed}/${result.results.length} proxy aktif.`);
      }
    } catch (err) {
      addToast('error', 'Test gagal');
    } finally {
      setTestingAll(false);
    }
  };

  // ---- Bulk Delete ----
  const handleBulkDelete = async () => {
    if (selectedProxies.size === 0) return;
    if (!confirm(`Yakin ingin menghapus ${selectedProxies.size} proxy?`)) return;
    let deleted = 0;
    for (const id of selectedProxies) {
      try {
        await window.electronAPI.proxies.delete(id);
        deleted++;
      } catch {}
    }
    setSelectedProxies(new Set());
    addToast('success', `${deleted} proxy dihapus`);
    fetchProxies();
  };

  const toggleSelect = (id: string) => {
    setSelectedProxies(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProxies.size === proxies.length) {
      setSelectedProxies(new Set());
    } else {
      setSelectedProxies(new Set(proxies.map(p => p.id)));
    }
  };

  const resetForm = () => {
    setFormHost('');
    setFormPort('');
    setFormUsername('');
    setFormPassword('');
    setFormType('http');
    setFormCountry('');
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <span>Memuat proxy...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Proxy Manager</h1>
          <p className="page-subtitle">{proxies.length} proxy terdaftar</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImportModal(true)}>
            📥 Import
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={proxies.length === 0}>
            📤 Export
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleTestAll}
            disabled={testingAll || proxies.length === 0}
          >
            {testingAll ? (
              <><div className="loading-spinner" style={{ width: 12, height: 12 }} /> Testing...</>
            ) : '🔍 Test All'}
          </button>
          {selectedProxies.size > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
              🗑️ Hapus ({selectedProxies.size})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            ➕ Tambah Proxy
          </button>
        </div>
      </div>

      {proxies.length === 0 && !showAddForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌐</div>
          <h3 className="empty-state-title">Belum ada proxy</h3>
          <p className="empty-state-text">Tambahkan proxy satu per satu atau import dari file TXT/CSV.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
              Tambah Proxy
            </button>
            <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
              📥 Import dari File
            </button>
          </div>
        </div>
      ) : (
        <>
          {proxies.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: 24 }}>
              <table className="proxy-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selectedProxies.size === proxies.length && proxies.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Host</th>
                    <th>Port</th>
                    <th>Type</th>
                    <th>Auth</th>
                    <th>Country</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {proxies.map(proxy => {
                    const tr = testResults.get(proxy.id);
                    return (
                      <tr key={proxy.id} className={selectedProxies.has(proxy.id) ? 'row-selected' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedProxies.has(proxy.id)}
                            onChange={() => toggleSelect(proxy.id)}
                          />
                        </td>
                        <td style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{proxy.host}</td>
                        <td style={{ fontFamily: 'monospace' }}>{proxy.port}</td>
                        <td><span className="proxy-type-badge">{proxy.proxy_type}</span></td>
                        <td>{proxy.username ? '🔐 Yes' : '—'}</td>
                        <td>{proxy.country || '—'}</td>
                        <td>
                          {tr ? (
                            tr.success ? (
                              <span style={{ color: 'var(--accent-success)', fontSize: 12 }}>
                                ✅ {tr.latency}ms
                              </span>
                            ) : (
                              <span style={{ color: 'var(--accent-danger)', fontSize: 12 }}>
                                ❌ {tr.error?.substring(0, 20)}
                              </span>
                            )
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleTestProxy(proxy.id)}
                              disabled={testingProxy === proxy.id}
                            >
                              {testingProxy === proxy.id ? (
                                <><div className="loading-spinner" style={{ width: 12, height: 12 }} /> Test...</>
                              ) : '🔍 Test'}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteProxy(proxy.id)}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add Proxy Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Tambah Proxy</h2>
            <form onSubmit={handleAddProxy}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Host / IP</label>
                  <input className="form-input" type="text" placeholder="192.168.1.1" value={formHost} onChange={e => setFormHost(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Port</label>
                  <input className="form-input" type="number" placeholder="8080" value={formPort} onChange={e => setFormPort(e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={formType} onChange={e => setFormType(e.target.value as any)}>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks5">SOCKS5</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Username (opsional)</label>
                  <input className="form-input" type="text" placeholder="username" value={formUsername} onChange={e => setFormUsername(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Password (opsional)</label>
                  <input className="form-input" type="password" placeholder="••••••" value={formPassword} onChange={e => setFormPassword(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Country (opsional)</label>
                <input className="form-input" type="text" placeholder="ID, US, SG..." value={formCountry} onChange={e => setFormCountry(e.target.value)} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddForm(false); resetForm(); }}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan Proxy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Proxy Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">📥 Import Proxy</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Format yang didukung: <code>host:port</code>, <code>host:port:user:pass</code>, <code>protocol://user:pass@host:port</code>
            </p>

            <div className="form-group">
              <label className="form-label">Paste Proxy List</label>
              <textarea
                className="form-input"
                rows={8}
                placeholder={'192.168.1.1:8080\n10.0.0.1:3128:admin:password\nsocks5://user:pass@proxy.example.com:1080'}
                value={importText}
                onChange={e => setImportText(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <input ref={fileInputRef} type="file" accept=".txt,.csv" onChange={handleFileImport} style={{ display: 'none' }} />
              <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                📁 Pilih File (.txt / .csv)
              </button>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => { setShowImportModal(false); setImportText(''); }}>Batal</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={!importText.trim()}>
                Import {importText.trim() ? `(${importText.trim().split('\n').filter(l => l.trim()).length} baris)` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast messages={toasts} />
    </>
  );
};

export default ProxyManager;

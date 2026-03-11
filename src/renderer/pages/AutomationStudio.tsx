import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Toast, { ToastMessage } from '../components/Toast';

interface Props {
  profileId: string;
  profileName: string;
  onClose: () => void;
}

const DEFAULT_SCRIPT = `// MultiAccount Automation Sandbox
// Object 'page' adalah instance aktif dari Puppeteer
// Anda bisa menggunakan seluruh API Puppeteer page!

console.log("Memulai navigasi...");
await page.goto('https://example.com');

const title = await page.title();
console.log("Judul halaman:", title);

// Contoh klik elemen
// await page.click('a');

// Anda juga bisa retur data
return { success: true, title };
`;

const AutomationStudio: React.FC<Props> = ({ profileId, profileName, onClose }) => {
  const { isPremium } = useAuth();
  const [scriptCode, setScriptCode] = useState(DEFAULT_SCRIPT);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleRun = async () => {
    if (!scriptCode.trim()) return;
    setRunning(true);
    setLogs(prev => [...prev, '\n> [SYSTEM] Menjalankan script...']);

    try {
      const result = await window.electronAPI.automation.run(profileId, scriptCode);
      
      setLogs(prev => [
        ...prev, 
        ...result.logs,
        result.success 
          ? `> [SYSTEM] Eksekusi Selesai. Return/Result: ${JSON.stringify(result.returnValue)}`
          : `> [SYSTEM] Eksekusi Gagal.`
      ]);

      if (result.success) {
        addToast('success', 'Script selesai tanpa error!');
      } else {
        addToast('error', result.error || 'Terjadi kesalahan sistem.');
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `[FATAL] IPC Error: ${err.message}`]);
      addToast('error', err.message);
    } finally {
      setRunning(false);
    }
  };

  if (!isPremium) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h2 className="modal-title">Fitur Premium 👑</h2>
          <p>
            Automation Engine (Node JS Sandbox) memungkinkan Anda menjalankan skrip otomatisasi tingkat lanjut langsung di dalam tab aktif browser.
          </p>
          <div className="form-actions" style={{ marginTop: 24 }}>
            <button className="btn btn-primary" onClick={onClose}>Tutup</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(8px)', zIndex: 100 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '80vw', maxWidth: 1000, height: '85vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="modal-title" style={{ marginBottom: 4 }}>⚡ Automation Studio</h2>
            <p className="page-subtitle" style={{ margin: 0 }}>Menjalankan script di profil: <strong>{profileName}</strong></p>
          </div>
          <button className="btn" onClick={onClose} style={{ background: 'transparent', padding: '8px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, gap: 16, minHeight: 0 }}>
          {/* Editor Panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label className="form-label">Script (Node.js / Puppeteer)</label>
            <textarea
              value={scriptCode}
              onChange={e => setScriptCode(e.target.value)}
              disabled={running}
              style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: 13,
                padding: 12,
                borderRadius: 'var(--radius-md)',
                background: '#1a1b1e',
                color: '#e0e0e0',
                border: '1px solid var(--border)',
                resize: 'none',
                lineHeight: 1.5,
              }}
              spellCheck={false}
            />
          </div>

          {/* Logs Panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Eksekusi Logs</label>
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ fontSize: 10, padding: '2px 8px' }}
                onClick={() => setLogs([])}
              >
                Clear
              </button>
            </div>
            <div
              ref={logRef}
              style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: 12,
                padding: 12,
                borderRadius: 'var(--radius-md)',
                background: '#0d0d0f',
                color: '#00ff00',
                border: '1px solid var(--border)',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.4,
              }}
            >
              {logs.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>Menunggu eksekusi...</span>
              ) : (
                logs.map((L, i) => (
                  <div key={i} style={{ 
                    color: L.includes('[ERROR]') || L.includes('[FATAL]') ? '#ff5555' : 
                           L.includes('[WARN]') ? '#ffb86c' : '#50fa7b' 
                  }}>
                    {L}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ justifyContent: 'space-between', marginTop: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            ⚠️ Harus dijalankan saat profil <strong>sedang aktif (Running)</strong>
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" disabled={running} onClick={onClose}>Tutup</button>
            <button className="btn btn-primary" disabled={running || !scriptCode} onClick={handleRun}>
              {running ? '⚙️ Mengeksekusi...' : '▶ Jalankan Script'}
            </button>
          </div>
        </div>

      </div>
      <Toast messages={toasts} />
    </div>
  );
};

export default AutomationStudio;

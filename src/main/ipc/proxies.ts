// ============================================
// IPC Handlers: Proxies (with Import/Export/TestAll)
// ============================================
import { ipcMain } from 'electron';
import { listProxies, createProxy, deleteProxy, testProxy } from '../database/proxies';
import log from 'electron-log';

const MAX_CONCURRENT_TESTS = 5;

export function registerProxyHandlers(): void {
  ipcMain.handle('proxies:list', async () => {
    try {
      return listProxies();
    } catch (err: any) {
      log.error('[IPC] proxies:list error:', err);
      throw err;
    }
  });

  ipcMain.handle('proxies:create', async (_event, data) => {
    try {
      return createProxy(data);
    } catch (err: any) {
      log.error('[IPC] proxies:create error:', err);
      throw err;
    }
  });

  ipcMain.handle('proxies:delete', async (_event, id: string) => {
    try {
      deleteProxy(id);
    } catch (err: any) {
      log.error('[IPC] proxies:delete error:', err);
      throw err;
    }
  });

  ipcMain.handle('proxies:test', async (_event, id: string) => {
    try {
      return await testProxy(id);
    } catch (err: any) {
      log.error('[IPC] proxies:test error:', err);
      return { success: false, error: err.message };
    }
  });

  // ---- Advanced Proxy: Import ----
  ipcMain.handle('proxies:import', async (_event, content: string) => {
    try {
      const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      let imported = 0;
      let failed = 0;

      for (const line of lines) {
        try {
          const parsed = parseProxyLine(line);
          if (parsed) {
            createProxy(parsed);
            imported++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      log.info(`[IPC] proxies:import — imported: ${imported}, failed: ${failed}`);
      return { success: true, imported, failed };
    } catch (err: any) {
      log.error('[IPC] proxies:import error:', err);
      return { success: false, error: err.message };
    }
  });

  // ---- Advanced Proxy: Export ----
  ipcMain.handle('proxies:export', async () => {
    try {
      const proxies = listProxies();
      const lines = proxies.map(p => {
        if (p.username && p.password) {
          return `${p.host}:${p.port}:${p.username}:${p.password}`;
        }
        return `${p.host}:${p.port}`;
      });
      return { success: true, content: lines.join('\n') };
    } catch (err: any) {
      log.error('[IPC] proxies:export error:', err);
      return { success: false, error: err.message };
    }
  });

  // ---- Advanced Proxy: Test All (Concurrent) ----
  ipcMain.handle('proxies:test-all', async () => {
    try {
      const proxies = listProxies();
      const results: Array<{ id: string; host: string; success: boolean; latency?: number; error?: string }> = [];

      // Process in batches of MAX_CONCURRENT_TESTS
      for (let i = 0; i < proxies.length; i += MAX_CONCURRENT_TESTS) {
        const batch = proxies.slice(i, i + MAX_CONCURRENT_TESTS);
        const batchResults = await Promise.all(
          batch.map(async (proxy) => {
            const result = await testProxy(proxy.id);
            return {
              id: proxy.id,
              host: `${proxy.host}:${proxy.port}`,
              ...result,
            };
          })
        );
        results.push(...batchResults);
      }

      const passed = results.filter(r => r.success).length;
      log.info(`[IPC] proxies:test-all — ${passed}/${results.length} passed`);
      return { success: true, results };
    } catch (err: any) {
      log.error('[IPC] proxies:test-all error:', err);
      return { success: false, error: err.message };
    }
  });
}

// ---- Proxy Line Parser ----
// Supports: host:port, host:port:user:pass, protocol://user:pass@host:port
function parseProxyLine(line: string): { host: string; port: number; username?: string; password?: string; proxy_type?: 'http' | 'https' | 'socks5' } | null {
  // Format: protocol://user:pass@host:port
  const urlMatch = line.match(/^(https?|socks5):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/i);
  if (urlMatch) {
    return {
      proxy_type: urlMatch[1].toLowerCase() as any,
      username: urlMatch[2] || undefined,
      password: urlMatch[3] || undefined,
      host: urlMatch[4],
      port: parseInt(urlMatch[5]),
    };
  }

  // Format: host:port:user:pass
  const parts = line.split(':');
  if (parts.length === 4) {
    return {
      host: parts[0],
      port: parseInt(parts[1]),
      username: parts[2],
      password: parts[3],
    };
  }

  // Format: host:port
  if (parts.length === 2) {
    const port = parseInt(parts[1]);
    if (!isNaN(port)) {
      return { host: parts[0], port };
    }
  }

  return null;
}

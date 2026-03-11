// ============================================
// Proxies CRUD Operations (with encryption)
// ============================================
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { getDatabase } from './connection';
import log from 'electron-log';
import type { Proxy, CreateProxyData } from '../../shared/types';

// Encryption key derived from machine-specific data
const ENCRYPTION_KEY = 'mam-proxy-enc-v1-' + (process.env.COMPUTERNAME || process.env.HOSTNAME || 'default');

function encryptPassword(password: string): string {
  return CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
}

function decryptPassword(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

function parseProxy(row: any): Proxy {
  return {
    ...row,
    password: row.password ? decryptPassword(row.password) : null,
    is_active: Boolean(row.is_active),
  };
}

export function listProxies(): Proxy[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM proxies ORDER BY is_active DESC, host ASC').all();
  return rows.map(parseProxy);
}

export function getProxy(id: string): Proxy | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM proxies WHERE id = ?').get(id);
  return row ? parseProxy(row) : null;
}

export function createProxy(data: CreateProxyData): Proxy {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO proxies (id, host, port, username, password, proxy_type, country, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  stmt.run(
    id,
    data.host,
    data.port,
    data.username || null,
    data.password ? encryptPassword(data.password) : null,
    data.proxy_type || 'http',
    data.country || null
  );

  log.info(`[Proxies] Created proxy: ${data.host}:${data.port} (${id})`);
  return getProxy(id)!;
}

export function deleteProxy(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM proxies WHERE id = ?').run(id);
  log.info(`[Proxies] Deleted proxy: ${id}`);
}

export async function testProxy(id: string): Promise<{ success: boolean; ip?: string; latency?: number; error?: string }> {
  const proxy = getProxy(id);
  if (!proxy) {
    return { success: false, error: 'Proxy not found' };
  }

  const start = Date.now();
  try {
    const proxyUrl = buildProxyUrl(proxy);
    // Use a simple HTTP request through the proxy to test connectivity
    const { default: http } = await import('http');
    const { URL } = await import('url');

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Connection timeout (10s)' });
      }, 10000);

      const parsedProxy = new URL(proxyUrl);

      const options = {
        host: parsedProxy.hostname,
        port: parseInt(parsedProxy.port),
        method: 'CONNECT',
        path: 'httpbin.org:80',
        headers: {} as Record<string, string>,
      };

      if (proxy.username && proxy.password) {
        const auth = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
        options.headers['Proxy-Authorization'] = `Basic ${auth}`;
      }

      const req = http.request(options);
      req.on('connect', (_res, socket) => {
        clearTimeout(timeout);
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ success: true, latency });
      });
      req.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, error: err.message });
      });
      req.end();
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function buildProxyUrl(proxy: Proxy): string {
  const protocol = proxy.proxy_type === 'socks5' ? 'socks5' : 'http';
  if (proxy.username && proxy.password) {
    return `${protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  }
  return `${protocol}://${proxy.host}:${proxy.port}`;
}

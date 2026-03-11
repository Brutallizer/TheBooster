// ============================================
// Browser Engine Manager (Puppeteer Core + Stealth)
// ============================================
import { Browser, Page } from 'puppeteer-core';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerExtra from 'puppeteer-extra';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import log from 'electron-log';
import { buildInjectionScript } from './fingerprint/injector';
import { getProxy, buildProxyUrl } from '../database/proxies';
import { updateLastUsed } from '../database/profiles';
import type { Profile } from '../../shared/types';
import { getActiveWorkspaceId } from '../workspace';
import { startSessionTracker, endSessionTracker } from '../analytics';

// Apply stealth plugin
puppeteerExtra.use(StealthPlugin());

// Track active browser instances by profile ID
const activeBrowsers: Map<string, Browser> = new Map();

function getChromiumPath(): string {
  // Check for bundled Chromium in resources
  const possiblePaths = [
    // Bundled with app
    path.join(process.resourcesPath || '', 'chromium', 'chrome.exe'),
    path.join(app.getPath('userData'), 'chromium', 'chrome.exe'),
    // System Chrome installations (Windows)
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      log.info(`[Browser] Found Chromium at: ${p}`);
      return p;
    }
  }

  throw new Error(
    'Chromium not found. Please install Google Chrome or set the path manually in Settings.'
  );
}

export async function launchBrowser(profile: Profile): Promise<Browser> {
  // Check if already running
  if (activeBrowsers.has(profile.id)) {
    log.warn(`[Browser] Profile ${profile.id} already has an active browser`);
    const existing = activeBrowsers.get(profile.id)!;
    if (existing.connected) {
      return existing;
    }
    activeBrowsers.delete(profile.id);
  }

  const chromiumPath = getChromiumPath();
  const config = profile.fingerprint_config;

  // Build launch args
  const args: string[] = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    `--window-size=${config.screen.width},${config.screen.height}`,
    `--lang=${config.language}`,
  ];

  // Proxy support (handles authenticated proxies too)
  if (profile.proxy_id) {
    const proxy = getProxy(profile.proxy_id);
    if (proxy && proxy.is_active) {
      const proxyArg = `${proxy.host}:${proxy.port}`;
      args.push(`--proxy-server=${proxy.proxy_type}://${proxyArg}`);
      log.info(`[Browser] Using proxy: ${proxy.proxy_type}://${proxyArg}`);
    }
  }

  log.info(`[Browser] Launching browser for profile: ${profile.name} (${profile.id})`);

  const browser = await puppeteerExtra.launch({
    executablePath: chromiumPath,
    headless: false,
    userDataDir: profile.storage_path,
    defaultViewport: {
      width: config.screen.width,
      height: config.screen.height,
      deviceScaleFactor: config.screen.pixelRatio,
    },
    args,
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // Inject fingerprint into every new page/tab
  browser.on('targetcreated', async (target: any) => {
    try {
      const page = await target.page();
      if (page) {
        await injectFingerprint(page, profile);
      }
    } catch (e) {
      // Target might not be a page (e.g. service worker)
    }
  });

  // Inject into existing pages
  const pages = await browser.pages();
  for (const page of pages) {
    await injectFingerprint(page, profile);
  }

  // Handle proxy authentication
  if (profile.proxy_id) {
    const proxy = getProxy(profile.proxy_id);
    if (proxy && proxy.username && proxy.password) {
      for (const page of pages) {
        await page.authenticate({
          username: proxy.username,
          password: proxy.password,
        });
      }
      // Also authenticate on new pages
      browser.on('targetcreated', async (target: any) => {
        try {
          const page = await target.page();
          if (page && proxy.username && proxy.password) {
            await page.authenticate({
              username: proxy.username,
              password: proxy.password,
            });
          }
        } catch (e) {}
      });
    }
  }

  // Track browser instance
  activeBrowsers.set(profile.id, browser);

  // Update last used timestamp
  updateLastUsed(profile.id);

  // Cleanup on close
  browser.on('disconnected', () => {
    activeBrowsers.delete(profile.id);
    log.info(`[Browser] Browser disconnected for profile: ${profile.name}`);
    const wsId = getActiveWorkspaceId();
    if (wsId) {
      endSessionTracker(profile.id);
    }
  });

  const wsId = getActiveWorkspaceId();
  if (wsId) {
    startSessionTracker(
      wsId,
      profile.id,
      profile.name,
      profile.proxy_id ? `${getProxy(profile.proxy_id)?.host}` : null
    );
  }

  log.info(`[Browser] Browser launched successfully for profile: ${profile.name}`);
  return browser;
}

async function injectFingerprint(page: Page, profile: Profile): Promise<void> {
  const script = buildInjectionScript(profile.fingerprint_config);

  // Use CDP to inject script before any other scripts run
  const client = await page.createCDPSession();
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: script,
  });

  // Also evaluate in current context
  try {
    await page.evaluate(script);
  } catch (e) {
    // Page might not be ready yet
  }

  // Set timezone via CDP
  try {
    await client.send('Emulation.setTimezoneOverride', {
      timezoneId: profile.fingerprint_config.timezone,
    });
  } catch (e) {}

  // Set user agent via CDP
  try {
    await client.send('Network.setUserAgentOverride', {
      userAgent: profile.fingerprint_config.userAgent,
      platform: profile.fingerprint_config.platform,
      acceptLanguage: profile.fingerprint_config.languages.join(','),
    });
  } catch (e) {}
}

export async function closeBrowser(profileId: string): Promise<void> {
  const browser = activeBrowsers.get(profileId);
  if (browser) {
    try {
      await browser.close();
    } catch (e) {
      log.warn(`[Browser] Error closing browser for profile ${profileId}:`, e);
    }
    activeBrowsers.delete(profileId);
  }
}

export function isProfileRunning(profileId: string): boolean {
  const browser = activeBrowsers.get(profileId);
  return browser !== undefined && browser.connected;
}

export async function closeAllBrowsers(): Promise<void> {
  const promises = Array.from(activeBrowsers.entries()).map(([id]) => closeBrowser(id));
  await Promise.all(promises);
  log.info('[Browser] All browsers closed');
}

export function getActiveBrowserCount(): number {
  return activeBrowsers.size;
}

export function getActiveBrowser(profileId: string): Browser | undefined {
  return activeBrowsers.get(profileId);
}

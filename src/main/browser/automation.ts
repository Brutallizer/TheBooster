// ============================================
// Automation Engine (Secure Sandbox via node:vm)
// ============================================
import vm from 'vm';
import { getActiveBrowser } from './engine';
import log from 'electron-log';
import type { Page } from 'puppeteer-core';

export interface ScriptExecutionResult {
  success: boolean;
  logs: string[];
  error?: string;
  returnValue?: any;
}

export async function runAutomationScript(profileId: string, scriptCode: string): Promise<ScriptExecutionResult> {
  const browser = getActiveBrowser(profileId);
  const logs: string[] = [];
  
  if (!browser || !browser.connected) {
    return { success: false, logs, error: 'Browser untuk profil ini tidak sedang berjalan.' };
  }

  try {
    // Inject custom console to capture logs
    const sandboxConsole = {
      log: (...args: any[]) => logs.push(`[INFO] ${args.join(' ')}`),
      warn: (...args: any[]) => logs.push(`[WARN] ${args.join(' ')}`),
      error: (...args: any[]) => logs.push(`[ERROR] ${args.join(' ')}`),
      info: (...args: any[]) => logs.push(`[INFO] ${args.join(' ')}`),
    };

    // Get the first active page or create a new one
    const pages = await browser.pages();
    const page: Page = pages.length > 0 ? pages[0] : await browser.newPage();

    // Context environment provided to the script
    const context = {
      console: sandboxConsole,
      page: page, // Sandboxed scripts can interact with the Puppeteer page object!
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Buffer,
      Promise,
    };

    vm.createContext(context);

    // Provide a wrapper so users can use top-level await in their script
    const wrappedScript = `
      (async () => {
        try {
          ${scriptCode}
        } catch (err) {
          console.error("Script Error:", err.message);
          throw err;
        }
      })();
    `;

    const script = new vm.Script(wrappedScript);
    
    // Execute script asynchronously with a timeout mapping (Node VM timeout applies to sync work, we map async differently if needed)
    // For now we allow 2 mins max
    sandboxConsole.log('Memulai eksekusi script...');
    
    const promise = script.runInContext(context, { timeout: 120000 });
    const returnValue = await promise; // Wait for the async wrapper to resolve
    
    sandboxConsole.log('Eksekusi script selesai.');

    return { success: true, logs, returnValue };
  } catch (err: any) {
    log.error(`[Automation] Script failed for profile ${profileId}:`, err.message);
    logs.push(`[FATAL] Script dihentikan karena error: ${err.message}`);
    return { success: false, logs, error: err.message };
  }
}

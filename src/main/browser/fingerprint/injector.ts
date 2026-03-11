// ============================================
// Fingerprint Injector (CDP Script Injection)
// ============================================
import type { FingerprintConfig } from '../../../shared/types';

/**
 * Returns a JS script string to be evaluated in the browser context
 * via Chrome DevTools Protocol (CDP). This overrides browser APIs
 * to match the given fingerprint config.
 */
export function buildInjectionScript(config: FingerprintConfig): string {
  return `
    (() => {
      // ========== Navigator Overrides ==========
      const overrideNavigator = (prop, value) => {
        try {
          Object.defineProperty(Navigator.prototype, prop, {
            get: () => value,
            configurable: true,
          });
        } catch(e) {}
      };

      overrideNavigator('userAgent', ${JSON.stringify(config.userAgent)});
      overrideNavigator('platform', ${JSON.stringify(config.platform)});
      overrideNavigator('language', ${JSON.stringify(config.language)});
      overrideNavigator('languages', Object.freeze(${JSON.stringify(config.languages)}));
      overrideNavigator('hardwareConcurrency', ${config.hardwareConcurrency});
      overrideNavigator('deviceMemory', ${config.deviceMemory});
      overrideNavigator('webdriver', false);

      // Override plugins (simulate normal browser plugins)
      Object.defineProperty(Navigator.prototype, 'plugins', {
        get: () => {
          const fakePlugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
          ];
          fakePlugins.length = 3;
          return fakePlugins;
        },
        configurable: true,
      });

      // Override mimeTypes
      Object.defineProperty(Navigator.prototype, 'mimeTypes', {
        get: () => {
          const fakeMimes = [
            { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
          ];
          fakeMimes.length = 2;
          return fakeMimes;
        },
        configurable: true,
      });

      // ========== Permission Override ==========
      const originalQuery = Permissions.prototype.query;
      Permissions.prototype.query = function(parameters) {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission });
        }
        return originalQuery.call(this, parameters);
      };

      // ========== Screen Override ==========
      Object.defineProperty(screen, 'width', { get: () => ${config.screen.width} });
      Object.defineProperty(screen, 'height', { get: () => ${config.screen.height} });
      Object.defineProperty(screen, 'availWidth', { get: () => ${config.screen.width} });
      Object.defineProperty(screen, 'availHeight', { get: () => ${config.screen.height - 40} });
      Object.defineProperty(screen, 'colorDepth', { get: () => ${config.screen.colorDepth} });
      Object.defineProperty(screen, 'pixelDepth', { get: () => ${config.screen.colorDepth} });
      Object.defineProperty(window, 'devicePixelRatio', { get: () => ${config.screen.pixelRatio} });

      // ========== Canvas Fingerprint Noise ==========
      const canvasNoise = ${JSON.stringify(config.canvas.noise)};
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          const data = imageData.data;
          // Apply deterministic noise based on canvasNoise hash
          for (let i = 0; i < canvasNoise.length && i < data.length; i += 4) {
            const noiseVal = canvasNoise.charCodeAt(i % canvasNoise.length) % 3 - 1;
            data[i] = Math.max(0, Math.min(255, data[i] + noiseVal));
          }
          ctx.putImageData(imageData, 0, 0);
        }
        return origToDataURL.call(this, type, quality);
      };

      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        const dataUrl = this.toDataURL(type, quality);
        const byteString = atob(dataUrl.split(',')[1]);
        const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        callback(new Blob([ab], { type: mimeString }));
      };

      // ========== WebGL Spoofing ==========
      const getParameterProxy = new Proxy(WebGLRenderingContext.prototype.getParameter, {
        apply: function(target, thisArg, args) {
          const param = args[0];
          // UNMASKED_VENDOR_WEBGL
          if (param === 0x9245) return ${JSON.stringify(config.canvas.webglVendor)};
          // UNMASKED_RENDERER_WEBGL
          if (param === 0x9246) return ${JSON.stringify(config.canvas.webglRenderer)};
          return Reflect.apply(target, thisArg, args);
        }
      });
      WebGLRenderingContext.prototype.getParameter = getParameterProxy;

      // Also override WebGL2
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParameterProxy2 = new Proxy(WebGL2RenderingContext.prototype.getParameter, {
          apply: function(target, thisArg, args) {
            const param = args[0];
            if (param === 0x9245) return ${JSON.stringify(config.canvas.webglVendor)};
            if (param === 0x9246) return ${JSON.stringify(config.canvas.webglRenderer)};
            return Reflect.apply(target, thisArg, args);
          }
        });
        WebGL2RenderingContext.prototype.getParameter = getParameterProxy2;
      }

      // ========== AudioContext Spoofing ==========
      const audioNoise = ${JSON.stringify(config.audio.fingerprint)};
      const origGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
      AnalyserNode.prototype.getFloatFrequencyData = function(array) {
        origGetFloatFrequencyData.call(this, array);
        for (let i = 0; i < array.length && i < audioNoise.length; i++) {
          array[i] += (audioNoise.charCodeAt(i % audioNoise.length) % 5 - 2) * 0.001;
        }
      };

      const origGetByteFrequencyData = AnalyserNode.prototype.getByteFrequencyData;
      AnalyserNode.prototype.getByteFrequencyData = function(array) {
        origGetByteFrequencyData.call(this, array);
        for (let i = 0; i < array.length && i < audioNoise.length; i++) {
          const noiseVal = audioNoise.charCodeAt(i % audioNoise.length) % 3 - 1;
          array[i] = Math.max(0, Math.min(255, array[i] + noiseVal));
        }
      };

      // ========== Timezone Override ==========
      const targetTZ = ${JSON.stringify(config.timezone)};
      const origDateTimeFormat = Intl.DateTimeFormat;
      const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = function() {
        const result = origResolvedOptions.call(this);
        result.timeZone = targetTZ;
        return result;
      };

      // ========== WebRTC IP Leak Prevention ==========
      const origRTCPeerConnection = window.RTCPeerConnection;
      if (origRTCPeerConnection) {
        window.RTCPeerConnection = class extends origRTCPeerConnection {
          constructor(config) {
            // Force TURN only to prevent IP leaks
            if (config && config.iceServers) {
              config.iceTransportPolicy = 'relay';
            }
            super(config);
          }
        };
      }

      // ========== Console Cleanup ==========
      // Remove traces of injection
      delete Object.getPrototypeOf(navigator).webdriver;
    })();
  `;
}

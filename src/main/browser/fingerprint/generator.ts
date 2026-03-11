// ============================================
// Fingerprint Generator (Deterministic / Seed-Based)
// ============================================
import crypto from 'crypto';
import type { FingerprintConfig } from '../../../shared/types';

// Seeded random number generator (deterministic)
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }

  return function () {
    hash = (hash * 1664525 + 1013904223) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffleAndSlice<T>(arr: T[], min: number, max: number, rng: () => number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  const count = Math.floor(rng() * (max - min + 1)) + min;
  return shuffled.slice(0, count);
}

// ---- Data Pools ----

const USER_AGENT_SETS = [
  {
    os: 'windows',
    platform: 'Win32',
    agents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ],
  },
  {
    os: 'macos',
    platform: 'MacIntel',
    agents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    ],
  },
  {
    os: 'linux',
    platform: 'Linux x86_64',
    agents: [
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    ],
  },
];

const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 2560, height: 1440 },
  { width: 1680, height: 1050 },
  { width: 1600, height: 900 },
];

const GPU_CONFIGS = [
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 5700 XT Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)' },
];

const LANGUAGES = [
  { lang: 'id-ID', langs: ['id-ID', 'id', 'en-US', 'en'] },
  { lang: 'en-US', langs: ['en-US', 'en'] },
  { lang: 'en-GB', langs: ['en-GB', 'en-US', 'en'] },
  { lang: 'ms-MY', langs: ['ms-MY', 'ms', 'en-US', 'en'] },
];

const TIMEZONES = [
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
];

const COMMON_FONTS = [
  'Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Georgia',
  'Courier New', 'Trebuchet MS', 'Lucida Console', 'Tahoma',
  'Impact', 'Comic Sans MS', 'Palatino Linotype', 'Segoe UI',
  'Calibri', 'Cambria', 'Consolas', 'Garamond', 'Book Antiqua',
  'Century Gothic', 'Franklin Gothic Medium',
];

const DEVICE_MEMORY = [2, 4, 8, 16];
const HARDWARE_CONCURRENCY = [2, 4, 6, 8, 12, 16];
const COLOR_DEPTHS = [24, 32];
const PIXEL_RATIOS = [1, 1.25, 1.5, 2];

// ---- Generator Function ----

export function generateFingerprint(seed: string): FingerprintConfig {
  const rng = seededRandom(seed);

  // Pick OS/browser combo
  const osSet = pickRandom(USER_AGENT_SETS, rng);
  const userAgent = pickRandom(osSet.agents, rng);
  const platform = osSet.platform;

  // Language
  const langConfig = pickRandom(LANGUAGES, rng);

  // Screen
  const screenRes = pickRandom(SCREEN_RESOLUTIONS, rng);

  // GPU
  const gpu = pickRandom(GPU_CONFIGS, rng);

  // Hardware (ensure consistency: high RAM = more cores possible)
  const memoryIdx = Math.floor(rng() * DEVICE_MEMORY.length);
  const deviceMemory = DEVICE_MEMORY[memoryIdx];
  // Higher memory → allow higher core counts
  const maxCoreIdx = Math.min(memoryIdx + 2, HARDWARE_CONCURRENCY.length - 1);
  const hardwareConcurrency = HARDWARE_CONCURRENCY[Math.floor(rng() * (maxCoreIdx + 1))];

  // Canvas noise (unique hash per profile)
  const canvasNoise = crypto
    .createHash('sha256')
    .update('canvas-' + seed)
    .digest('hex')
    .substring(0, 16);

  // Audio fingerprint
  const audioFingerprint = crypto
    .createHash('sha256')
    .update('audio-' + seed)
    .digest('hex')
    .substring(0, 16);

  // Fonts (random subset)
  const fonts = shuffleAndSlice(COMMON_FONTS, 8, 15, rng);

  // Timezone
  const timezone = pickRandom(TIMEZONES, rng);

  // WebRTC IPs (fake)
  const privateIP = `192.168.${Math.floor(rng() * 255)}.${Math.floor(rng() * 254) + 1}`;
  const publicIP = `${Math.floor(rng() * 200) + 20}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 254) + 1}`;

  return {
    userAgent,
    platform,
    language: langConfig.lang,
    languages: langConfig.langs,
    canvas: {
      noise: canvasNoise,
      webglVendor: gpu.vendor,
      webglRenderer: gpu.renderer,
    },
    screen: {
      width: screenRes.width,
      height: screenRes.height,
      colorDepth: pickRandom(COLOR_DEPTHS, rng),
      pixelRatio: pickRandom(PIXEL_RATIOS, rng),
    },
    audio: {
      fingerprint: audioFingerprint,
    },
    fonts,
    timezone,
    webRTC: {
      publicIP,
      privateIP,
    },
    deviceMemory,
    hardwareConcurrency,
  };
}

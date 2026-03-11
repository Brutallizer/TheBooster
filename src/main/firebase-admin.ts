// ============================================
// Firebase Admin SDK (Main Process - Secure Token Verification)
// ============================================
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';

let initialized = false;

export function initFirebaseAdmin(): void {
  if (initialized) return;

  try {
    // Try to find service account JSON
    const possiblePaths = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
      path.join(process.cwd(), 'firebase-service-account.json'),
      path.join(__dirname, '..', '..', '..', 'firebase-service-account.json'),
    ];

    let serviceAccountPath = '';
    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        serviceAccountPath = p;
        break;
      }
    }

    if (serviceAccountPath) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      log.info('[FirebaseAdmin] Initialized with service account');
    } else {
      // Initialize without credentials (limited functionality)
      // Token verification will fall back to offline mode
      log.warn('[FirebaseAdmin] No service account found. Running in offline mode.');
      log.warn('[FirebaseAdmin] Place firebase-service-account.json in project root.');
      initialized = true;
      return;
    }

    initialized = true;
  } catch (err: any) {
    log.error('[FirebaseAdmin] Initialization error:', err.message);
    initialized = true; // Prevent retry loops
  }
}

export async function verifyIdToken(idToken: string): Promise<{
  uid: string;
  email: string;
  tier: 'free' | 'premium';
} | null> {
  if (!admin.apps.length) {
    log.warn('[FirebaseAdmin] No Firebase app initialized, skipping verification');
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || '';

    // Check custom claims first
    if (decoded.tier) {
      return { uid, email, tier: decoded.tier as 'free' | 'premium' };
    }

    // Fallback: check Firestore
    try {
      const userDoc = await admin.firestore().collection('users').doc(uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        const tier = data?.tier === 'premium' ? 'premium' : 'free';
        return { uid, email, tier };
      }
    } catch (firestoreErr) {
      log.warn('[FirebaseAdmin] Firestore lookup failed, defaulting to free tier');
    }

    return { uid, email, tier: 'free' };
  } catch (err: any) {
    log.error('[FirebaseAdmin] Token verification failed:', err.message);
    return null;
  }
}

export function isAdminInitialized(): boolean {
  return initialized && admin.apps.length > 0;
}

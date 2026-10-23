import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getDatabase, type Database } from "firebase/database";
import { getDesktopBridge, hasDesktopCapability } from "./desktop";

// Desktop app (shell with 'offline-cache'): Firestore keeps its cache on disk, so the app starts from the last
// data and works offline; several windows share it (multi-tab manager). The shell wipes it on sign-out.
const desktopOfflineCache = hasDesktopCapability('offline-cache');

// Local-only: `VITE_USE_FIREBASE_EMULATORS=true` points Auth/Firestore/Storage at
// the emulators from firebase.json and swaps in an offline demo project id.
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

// Safari (ITP) blocks the storage of a third-party auth domain, so a Google/GitHub
// popup served from `*.firebaseapp.com` hangs on "Bitte warten". On domains served
// by Firebase Hosting we use the page's own host, which serves `/__/auth/handler`.
// Each host needs `https://<host>/__/auth/handler` as an OAuth redirect URI.
const SAME_ORIGIN_AUTH_HOSTS = ['app.getprojectflow.com'];
const resolveAuthDomain = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return SAME_ORIGIN_AUTH_HOSTS.includes(host) ? host : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (useEmulators ? 'demo-api-key' : undefined),
  authDomain: resolveAuthDomain(),
  projectId: useEmulators ? 'demo-projectflow' : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  // Realtime Database powers the presence/online-state feature (onDisconnect).
  // Optional: when unset, presence degrades gracefully (no online indicators).
  databaseURL: useEmulators ? undefined : import.meta.env.VITE_FIREBASE_DATABASE_URL
};

let app;
let auth;
let db;
let storage;
let functions;
let rtdb: Database | undefined;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = desktopOfflineCache
    ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
    : getFirestore(app);
  if (desktopOfflineCache && getDesktopBridge()?.windowKind === 'main') {
    let signedInUid: string | null = null;
    onAuthStateChanged(auth, (user) => {
      if (signedInUid && !user) {
        // Local copies of workspace data (palette results) go with the Firestore cache.
        Object.keys(localStorage).filter((key) => key.startsWith('pf_desktop_palette_items_')).forEach((key) => localStorage.removeItem(key));
        getDesktopBridge()?.clearOfflineCache?.();
      }
      signedInUid = user?.uid ?? null;
    });
  }
  storage = getStorage(app);
  functions = getFunctions(app, 'europe-west3');

  if (useEmulators) {
    const emulatorPort = (key: string, fallback: number) => Number(import.meta.env[key]) || fallback;
    connectAuthEmulator(auth, `http://127.0.0.1:${emulatorPort('VITE_EMULATOR_AUTH_PORT', 9099)}`, { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', emulatorPort('VITE_EMULATOR_FIRESTORE_PORT', 8085));
    connectStorageEmulator(storage, '127.0.0.1', emulatorPort('VITE_EMULATOR_STORAGE_PORT', 9199));
    connectFunctionsEmulator(functions, '127.0.0.1', emulatorPort('VITE_EMULATOR_FUNCTIONS_PORT', 5001));

    // scripts/dev-e2e.sh starts the app already signed in as a seeded emulator account.
    const autoLoginEmail = import.meta.env.VITE_E2E_AUTO_LOGIN_EMAIL;
    const autoLoginPassword = import.meta.env.VITE_E2E_AUTO_LOGIN_PASSWORD;
    if (import.meta.env.DEV && autoLoginEmail && autoLoginPassword) {
      void auth.authStateReady().then(() => {
        if (auth.currentUser) return;
        signInWithEmailAndPassword(auth, autoLoginEmail, autoLoginPassword)
          .catch((loginError) => console.error("Emulator auto-login failed:", loginError));
      });
    }
  }

  // Realtime Database is only initialized when a database URL is configured.
  // Presence is the only consumer; if RTDB is not set up yet the app keeps
  // working and online indicators simply stay empty.
  if (firebaseConfig.databaseURL) {
    try {
      rtdb = getDatabase(app);
    } catch (rtdbError) {
      console.warn("Realtime Database not available; presence disabled.", rtdbError);
      rtdb = undefined;
    }
  }

  // We always call the deployed (production) Cloud Functions, including from
  // localhost. The passkey functions are localhost-aware: they honour the
  // client origin so WebAuthn works on `http://localhost:3000` as well as in
  // production. No emulator is required.
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Throw error so it is visible in console if app fails to load
  throw error;
}

import { GithubAuthProvider, FacebookAuthProvider } from "firebase/auth";

export { auth, db, storage, functions, rtdb, GithubAuthProvider, FacebookAuthProvider };
export { app, firebaseConfig };

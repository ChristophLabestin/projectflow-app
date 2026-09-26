import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getDatabase, type Database } from "firebase/database";

// Local-only: `VITE_USE_FIREBASE_EMULATORS=true` points Auth/Firestore/Storage at
// the emulators from firebase.json and swaps in an offline demo project id.
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (useEmulators ? 'demo-api-key' : undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
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
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app, 'europe-west3');

  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8085);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
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

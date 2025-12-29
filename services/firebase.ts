import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app;
let auth;
let db;
let storage;
let functions;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  // Use the custom domain for functions
  functions = getFunctions(app, 'app.getprojectflow.com');

  // Connect to emulators if running locally
  if (location.hostname === 'localhost') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
    // const { connectAuthEmulator } = require('firebase/auth'); 
    // const { connectFirestoreEmulator } = require('firebase/firestore');

    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('Connected to Functions Emulator');

    // Uncomment if you run auth/firestore emulators too:
    // connectAuthEmulator(auth, 'http://localhost:9099');
    // connectFirestoreEmulator(db, 'localhost', 8080);
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Throw error so it is visible in console if app fails to load
  throw error;
}

import { GithubAuthProvider, FacebookAuthProvider } from "firebase/auth";

export { auth, db, storage, functions, GithubAuthProvider, FacebookAuthProvider };
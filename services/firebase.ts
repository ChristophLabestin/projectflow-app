import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBo-pzCCfgPTIyoUNjDI3xhKytpjXaTTtw",
  authDomain: "project-manager-9d0ad.firebaseapp.com",
  projectId: "project-manager-9d0ad",
  storageBucket: "project-manager-9d0ad.firebasestorage.app",
  messagingSenderId: "156746866932",
  appId: "1:156746866932:web:48cc57f5ae6509dcc9bea1",
  measurementId: "G-1X19XQK677"
};

let app;
let auth;
let db;
let storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Throw error so it is visible in console if app fails to load
  throw error;
}

import { GithubAuthProvider, FacebookAuthProvider } from "firebase/auth";

export { auth, db, storage, GithubAuthProvider, FacebookAuthProvider };
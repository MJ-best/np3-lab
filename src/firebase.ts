/*
 * Firebase for the hosted web version only: Google sign-in and Firestore (Lite: plain requests,
 * no offline cache). Loaded on demand from account.ts, so the other builds don't carry it.
 * The web config isn't secret; access is limited by firestore.rules.
 */
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore/lite";

const emulator = import.meta.env.VITE_FIREBASE_EMULATOR === "1";
const projectId = emulator ? "demo-np3lab" : "np3-lab";

const app = initializeApp({
  apiKey: emulator ? "demo-key" : "AIzaSyBqHk0Xae484O9YGnmpTT-fmakjQL7UBV4",
  appId: emulator ? "demo-app" : "1:808573237131:web:6088f1095187207887a18e",
  projectId,
  // The default domain needs no extra OAuth redirect URI; popup sign-in works with it even where
  // third-party storage is blocked (only redirect sign-in would need the site's own domain).
  authDomain: `${projectId}.firebaseapp.com`,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: "select_account" });

if (emulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export { deleteUser, onAuthStateChanged, reauthenticateWithPopup, signInWithPopup, signOut } from "firebase/auth";
export { collection, doc, getDocs, writeBatch } from "firebase/firestore/lite";

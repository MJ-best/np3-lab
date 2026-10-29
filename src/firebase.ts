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

// Sign in through the site's own domain when served by Firebase Hosting, so browsers that block
// third-party storage still complete the sign-in.
const ownDomain = [`${projectId}.web.app`, `${projectId}.firebaseapp.com`].includes(location.hostname);

const app = initializeApp({
  apiKey: emulator ? "demo-key" : "",
  appId: emulator ? "demo-app" : "",
  projectId,
  authDomain: ownDomain ? location.hostname : `${projectId}.firebaseapp.com`,
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

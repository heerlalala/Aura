import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { firebaseConfig, isFirebaseConfigReady } from "./firebase-config.js";

let auth = null;
let initializationError = null;

if (isFirebaseConfigReady) {
  try {
    auth = getAuth(initializeApp(firebaseConfig));
  } catch (error) {
    initializationError = error;
  }
}

// The classic Aura controller reads this bridge after DOMContentLoaded. Keeping the
// Firebase imports and project config in modules avoids coupling app logic to the SDK.
window.auraFirebase = Object.freeze({
  auth,
  configured: Boolean(auth),
  initializationError,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut
});

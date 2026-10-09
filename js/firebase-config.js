// IMPORTANT: do not commit real Firebase client credentials.
// Firebase keys are public in the browser, but they must still be restricted in the
// Google Cloud / Firebase console and never stored directly in source control.
//
// Safe pattern for a static site:
//   1) Create a local, untracked config file or set a global before this module loads:
//      window.__AURA_FIREBASE_CONFIG__ = { apiKey: "...", authDomain: "...", ... };
//   2) Keep that file out of Git history.
//
// If no runtime config is supplied, the app will refuse to initialize.
const emptyFirebaseConfig = Object.freeze({
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
});

const runtimeConfig = typeof window !== "undefined" ? window.__AURA_FIREBASE_CONFIG__ : null;

export const firebaseConfig = Object.freeze(runtimeConfig || emptyFirebaseConfig);

const hasPlaceholderValue = (value) =>
  typeof value === "string" && value.trim().length > 0 && value.includes("REPLACE_WITH_");

export const isFirebaseConfigReady = Boolean(
  firebaseConfig &&
  firebaseConfig.apiKey &&
  !hasPlaceholderValue(firebaseConfig.apiKey) &&
  firebaseConfig.appId &&
  firebaseConfig.projectId
);

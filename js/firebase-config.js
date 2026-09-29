// Firebase Web app configuration is public client configuration, not a secret.
// Copy the values for the registered Aura Web app from Firebase Console > Project settings.
export const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyDQelbnZGQyUHunfYp3wOVaiFHPhA8lUE8",
  authDomain: "aura-dd66e.firebaseapp.com",
  projectId: "aura-dd66e",
  storageBucket: "aura-dd66e.firebasestorage.app",
  messagingSenderId: "816437945650",
  appId: "1:816437945650:web:004dd0f8e4728f43f3a32b",
  measurementId: "G-SY0BF7CLMD"
});

export const isFirebaseConfigReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.appId && firebaseConfig.projectId
);

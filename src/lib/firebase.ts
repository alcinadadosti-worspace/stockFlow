import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const hasFirebaseConfig = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;

function getApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    if (!hasFirebaseConfig) {
      throw new Error('Firebase not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY.');
    }
    if (!_auth) _auth = getAuth(getApp());
    return Reflect.get(_auth, prop, receiver);
  },
});

export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop, receiver) {
    if (!hasFirebaseConfig) {
      throw new Error('Firebase not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY.');
    }
    if (!_db) _db = getFirestore(getApp());
    return Reflect.get(_db, prop, receiver);
  },
});

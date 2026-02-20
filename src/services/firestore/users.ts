import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { AppUser, UserRole } from '@/types';

const COLLECTION = 'users';

export async function createUser(uid: string, data: { name: string; email: string; role?: UserRole }): Promise<void> {
  await setDoc(doc(getFirebaseDb(), COLLECTION, uid), {
    name: data.name,
    email: data.email,
    role: data.role || 'ESTOQUISTA',
    createdAt: Timestamp.now(),
    xpTotal: 0,
    streak: 0,
    lastActivityDate: null,
  });
}

export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(getFirebaseDb(), COLLECTION, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as AppUser;
}

export async function updateUser(uid: string, data: Partial<AppUser>): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), COLLECTION, uid), data as Record<string, unknown>);
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), COLLECTION, uid), { role });
}

export async function getAllUsers(): Promise<AppUser[]> {
  const q = query(collection(getFirebaseDb(), COLLECTION), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AppUser);
}

export async function getEstoquistas(): Promise<AppUser[]> {
  const users = await getAllUsers();
  return users.filter((u) => u.role === 'ESTOQUISTA');
}

export async function getAdmins(): Promise<AppUser[]> {
  const users = await getAllUsers();
  return users.filter((u) => u.role === 'ADMIN');
}

export async function incrementUserXp(uid: string, xp: number): Promise<void> {
  const userRef = doc(getFirebaseDb(), COLLECTION, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;
  const current = snap.data().xpTotal || 0;
  await updateDoc(userRef, { xpTotal: current + xp });
}

export async function updateUserStreak(uid: string): Promise<void> {
  const userRef = doc(getFirebaseDb(), COLLECTION, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const lastDate = data.lastActivityDate;

  if (lastDate === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const newStreak = lastDate === yesterday ? (data.streak || 0) + 1 : 1;

  await updateDoc(userRef, {
    streak: newStreak,
    lastActivityDate: today,
  });
}

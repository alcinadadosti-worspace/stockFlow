import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { AppUser, UserRole } from '@/types';

const COLLECTION = 'users';

export async function createUser(uid: string, data: { name: string; email: string; role?: UserRole; filial?: string }): Promise<void> {
  await setDoc(doc(getFirebaseDb(), COLLECTION, uid), {
    name: data.name,
    email: data.email,
    role: data.role || 'ESTOQUISTA',
    createdAt: Timestamp.now(),
    xpTotal: 0,
    streak: 0,
    lastActivityDate: null,
    ...(data.filial ? { filial: data.filial } : {}),
  });
}

export async function updateUserFilial(uid: string, filial: string | null): Promise<void> {
  if (filial) {
    await updateDoc(doc(getFirebaseDb(), COLLECTION, uid), { filial });
  } else {
    await updateDoc(doc(getFirebaseDb(), COLLECTION, uid), { filial: deleteField() });
  }
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
  if (xp <= 0) return;
  const userRef = doc(getFirebaseDb(), COLLECTION, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;
  await updateDoc(userRef, { xpTotal: increment(xp) });
}

export async function decrementUserXp(uid: string, xp: number): Promise<void> {
  if (xp <= 0) return;
  const userRef = doc(getFirebaseDb(), COLLECTION, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;
  const current = snap.data().xpTotal || 0;
  const newXp = Math.max(0, current - xp);
  await updateDoc(userRef, { xpTotal: newXp });
}

export async function updateUserStreak(uid: string): Promise<void> {
  const userRef = doc(getFirebaseDb(), COLLECTION, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const today = new Date().toLocaleDateString('sv'); // YYYY-MM-DD no fuso local
  const lastDate = data.lastActivityDate;

  if (lastDate === today) return;

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toLocaleDateString('sv');
  const newStreak = lastDate === yesterday ? (data.streak || 0) + 1 : 1;

  await updateDoc(userRef, {
    streak: newStreak,
    lastActivityDate: today,
  });
}

// Deleta usuario do Firestore (nao deleta do Firebase Auth)
export async function deleteUser(uid: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), COLLECTION, uid));
}

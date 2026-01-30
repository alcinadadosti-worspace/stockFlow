import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TaskType } from '@/types';

const COLLECTION = 'taskTypes';

export async function getActiveTaskTypes(): Promise<TaskType[]> {
  const q = query(
    collection(db, COLLECTION),
    where('active', '==', true),
    orderBy('name'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskType);
}

export async function getAllTaskTypes(): Promise<TaskType[]> {
  const q = query(collection(db, COLLECTION), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskType);
}

export async function createTaskType(data: { name: string; xp: number }): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    name: data.name,
    xp: data.xp,
    active: true,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateTaskType(id: string, data: { name?: string; xp?: number; active?: boolean }): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), data);
}

export async function deleteTaskType(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

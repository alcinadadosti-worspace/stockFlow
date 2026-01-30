import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TaskLog } from '@/types';
import { incrementUserXp, updateUserStreak } from './users';

const COLLECTION = 'taskLogs';

export async function createTaskLog(data: {
  uid: string;
  userName: string;
  taskTypeId: string;
  taskTypeName: string;
  xp: number;
  quantity: number;
  note: string;
}): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTION), {
    uid: data.uid,
    userName: data.userName,
    taskTypeId: data.taskTypeId,
    taskTypeName: data.taskTypeName,
    xp: data.xp,
    quantity: data.quantity,
    note: data.note,
    occurredAt: now,
    createdAt: now,
  });

  await incrementUserXp(data.uid, data.xp);
  await updateUserStreak(data.uid);

  return docRef.id;
}

export async function getTaskLogsByUser(uid: string): Promise<TaskLog[]> {
  const q = query(
    collection(db, COLLECTION),
    where('uid', '==', uid),
    orderBy('occurredAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskLog);
}

export async function getAllTaskLogs(): Promise<TaskLog[]> {
  const q = query(
    collection(db, COLLECTION),
    orderBy('occurredAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskLog);
}

export async function getTaskLogsByPeriod(
  uid: string | null,
  startDate: Date,
  endDate: Date,
): Promise<TaskLog[]> {
  const constraints = [
    where('occurredAt', '>=', Timestamp.fromDate(startDate)),
    where('occurredAt', '<=', Timestamp.fromDate(endDate)),
    orderBy('occurredAt', 'desc'),
  ];

  if (uid) {
    constraints.unshift(where('uid', '==', uid));
  }

  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskLog);
}

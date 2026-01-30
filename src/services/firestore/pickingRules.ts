import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { PickingRules } from '@/types';
import { DEFAULT_PICKING_RULES } from '@/lib/constants';

const DOC_PATH = 'pickingRules/default';

export async function getPickingRules(): Promise<PickingRules> {
  const snap = await getDoc(doc(getFirebaseDb(), DOC_PATH));
  if (!snap.exists()) {
    return DEFAULT_PICKING_RULES;
  }
  return snap.data() as PickingRules;
}

export async function updatePickingRules(data: PickingRules): Promise<void> {
  await setDoc(doc(getFirebaseDb(), DOC_PATH), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

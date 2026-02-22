import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { Operator } from '@/types';

const COLLECTION = 'operators';

// Busca todos os operadores
export async function getAllOperators(): Promise<Operator[]> {
  const q = query(
    collection(getFirebaseDb(), COLLECTION),
    orderBy('code', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data() }) as Operator);
}

// Busca operadores ativos
export async function getActiveOperators(): Promise<Operator[]> {
  const q = query(
    collection(getFirebaseDb(), COLLECTION),
    where('active', '==', true),
    orderBy('code', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data() }) as Operator);
}

// Busca operador por código
export async function getOperatorByCode(code: string): Promise<Operator | null> {
  const snap = await getDoc(doc(getFirebaseDb(), COLLECTION, code));
  if (!snap.exists()) return null;
  return snap.data() as Operator;
}

// Cria novo operador
export async function createOperator(code: string, name: string): Promise<void> {
  // Validar formato do código (2 dígitos)
  if (!/^\d{2}$/.test(code)) {
    throw new Error('Código deve ter exatamente 2 dígitos');
  }

  // Verificar se já existe
  const existing = await getOperatorByCode(code);
  if (existing) {
    throw new Error(`Operador ${code} já existe`);
  }

  await setDoc(doc(getFirebaseDb(), COLLECTION, code), {
    code,
    name,
    active: true,
    xpTotal: 0,
    streak: 0,
    createdAt: Timestamp.now(),
  });
}

// Atualiza operador
export async function updateOperator(
  code: string,
  data: Partial<Pick<Operator, 'name' | 'active'>>,
): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), COLLECTION, code), data);
}

// Deleta operador
export async function deleteOperator(code: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), COLLECTION, code));
}

// Incrementa XP do operador
export async function incrementOperatorXp(code: string, xp: number): Promise<void> {
  const operatorRef = doc(getFirebaseDb(), COLLECTION, code);
  const snap = await getDoc(operatorRef);
  if (!snap.exists()) return;

  const current = snap.data().xpTotal || 0;
  await updateDoc(operatorRef, { xpTotal: current + xp });
}

// Decrementa XP do operador
export async function decrementOperatorXp(code: string, xp: number): Promise<void> {
  const operatorRef = doc(getFirebaseDb(), COLLECTION, code);
  const snap = await getDoc(operatorRef);
  if (!snap.exists()) return;

  const current = snap.data().xpTotal || 0;
  const newXp = Math.max(0, current - xp);
  await updateDoc(operatorRef, { xpTotal: newXp });
}

// Atualiza streak do operador
export async function updateOperatorStreak(code: string): Promise<void> {
  const operatorRef = doc(getFirebaseDb(), COLLECTION, code);
  const snap = await getDoc(operatorRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const today = new Date().toISOString().split('T')[0];
  const lastDate = data.lastActivityDate;

  let newStreak = 1;
  if (lastDate) {
    const last = new Date(lastDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      newStreak = (data.streak || 0) + 1;
    } else if (diffDays === 0) {
      newStreak = data.streak || 1;
    }
  }

  await updateDoc(operatorRef, {
    streak: newStreak,
    lastActivityDate: today,
  });
}

// Verifica se código já existe
export async function checkOperatorCodeExists(code: string): Promise<boolean> {
  const snap = await getDoc(doc(getFirebaseDb(), COLLECTION, code));
  return snap.exists();
}

// Seed de operadores padrão
const DEFAULT_OPERATORS = [
  { code: '77', name: 'Hugo Castro' },
  { code: '33', name: 'João Victor' },
  { code: '44', name: 'Pedro Lucas' },
];

export async function seedDefaultOperators(): Promise<{ created: string[]; existing: string[] }> {
  const created: string[] = [];
  const existing: string[] = [];

  for (const op of DEFAULT_OPERATORS) {
    const exists = await checkOperatorCodeExists(op.code);
    if (exists) {
      existing.push(op.code);
    } else {
      await setDoc(doc(getFirebaseDb(), COLLECTION, op.code), {
        code: op.code,
        name: op.name,
        active: true,
        xpTotal: 0,
        streak: 0,
        createdAt: Timestamp.now(),
      });
      created.push(op.code);
    }
  }

  return { created, existing };
}

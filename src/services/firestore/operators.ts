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
  increment,
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
  // Buscar todos e filtrar no cliente para evitar necessidade de indice composto
  const q = query(
    collection(getFirebaseDb(), COLLECTION),
    orderBy('code', 'asc'),
  );
  const snap = await getDocs(q);
  const all = snap.docs.map((d) => ({ ...d.data() }) as Operator);
  return all.filter((op) => op.active === true);
}

// Busca operador por código
export async function getOperatorByCode(code: string): Promise<Operator | null> {
  const snap = await getDoc(doc(getFirebaseDb(), COLLECTION, code));
  if (!snap.exists()) return null;
  return snap.data() as Operator;
}

// Cria novo operador
export async function createOperator(code: string, name: string, filial?: string): Promise<void> {
  if (!/^\d{2}$/.test(code)) {
    throw new Error('Código deve ter exatamente 2 dígitos');
  }

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
    ...(filial ? { filial } : {}),
  });
}

// Atualiza operador
export async function updateOperator(
  code: string,
  data: Partial<Pick<Operator, 'name' | 'active' | 'avatar' | 'filial'>>,
): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), COLLECTION, code), data);
}

// Deleta operador
export async function deleteOperator(code: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), COLLECTION, code));
}

// Incrementa XP do operador
export async function incrementOperatorXp(code: string, xp: number): Promise<void> {
  if (xp <= 0) return;
  const operatorRef = doc(getFirebaseDb(), COLLECTION, code);
  const snap = await getDoc(operatorRef);
  if (!snap.exists()) return;
  await updateDoc(operatorRef, { xpTotal: increment(xp) });
}

// Decrementa XP do operador
export async function decrementOperatorXp(code: string, xp: number): Promise<void> {
  if (xp <= 0) return;
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
  const today = new Date().toLocaleDateString('sv'); // YYYY-MM-DD no fuso local
  const lastDate = data.lastActivityDate;

  if (lastDate === today) {
    return;
  }

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toLocaleDateString('sv');

  let newStreak = 1;
  if (lastDate === yesterday) {
    newStreak = (data.streak || 0) + 1;
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
  // Palmeira
  { code: '44', name: 'Hugo Castro', filial: 'palmeira' },
  { code: '33', name: 'João Victor', filial: 'palmeira' },
  { code: '77', name: 'Pedro Lucas', filial: 'palmeira' },
  { code: '55', name: 'Robériia Gilo', filial: 'palmeira' },
  // Matriz
  { code: '11', name: 'Danrley', filial: 'matriz' },
  { code: '22', name: 'Felipe Guedes', filial: 'matriz' },
  { code: '66', name: 'Paulo Cesar', filial: 'matriz' },
  { code: '88', name: 'Yuri Castro', filial: 'matriz' },
  { code: '99', name: 'Luciano Torres', filial: 'matriz' },
  { code: '10', name: 'Claudio', filial: 'matriz' },
  { code: '20', name: 'Thalys Gomes', filial: 'matriz' },
];

export async function seedDefaultOperators(): Promise<{ created: string[]; existing: string[] }> {
  const created: string[] = [];
  const existing: string[] = [];

  for (const op of DEFAULT_OPERATORS) {
    const exists = await checkOperatorCodeExists(op.code);
    if (exists) {
      // Atualiza nome e filial para corrigir dados desatualizados
      await updateDoc(doc(getFirebaseDb(), COLLECTION, op.code), {
        name: op.name,
        filial: op.filial,
      });
      existing.push(op.code);
    } else {
      await setDoc(doc(getFirebaseDb(), COLLECTION, op.code), {
        code: op.code,
        name: op.name,
        filial: op.filial,
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

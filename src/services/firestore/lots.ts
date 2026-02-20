import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { Lot, LotOrder, LotStatus, LotWorkMode, ParsedOrder } from '@/types';
import { incrementUserXp, updateUserStreak } from './users';
import { getPickingRules } from './pickingRules';
import { calculateLotXp } from '@/lib/xp';

export async function createLot(
  lotCode: string,
  orders: ParsedOrder[],
  createdByUid: string,
  createdByName: string,
  workMode: LotWorkMode = 'GERAL',
): Promise<string> {
  const lotId = lotCode;
  const now = Timestamp.now();

  const totalItems = orders.reduce((sum, o) => sum + o.items, 0);
  const cycle = orders[0]?.cycle || '';

  // Para modo SEPARADOR, já define o separador como o criador
  const separatorData = workMode === 'SEPARADOR' || workMode === 'GERAL'
    ? { separatorUid: createdByUid, separatorName: createdByName }
    : {};

  await setDoc(doc(getFirebaseDb(), 'lots', lotId), {
    lotCode,
    createdByUid,
    createdByName,
    status: 'DRAFT' as LotStatus,
    cycle,
    startAt: null,
    endAt: null,
    createdAt: now,
    totals: { orders: orders.length, items: totalItems },
    xpEarned: 0,
    durationMs: 0,
    workMode,
    ...separatorData,
  });

  const batch = writeBatch(getFirebaseDb());
  for (const order of orders) {
    const orderRef = doc(getFirebaseDb(), 'lots', lotId, 'orders', order.orderCode);
    batch.set(orderRef, {
      orderCode: order.orderCode,
      cycle: order.cycle,
      approvedAt: order.approvedAt ? Timestamp.fromDate(order.approvedAt) : null,
      items: order.items,
      status: 'PENDING',
      sealedCode: null,
      sealedAt: null,
      createdAt: now,
    });
  }
  await batch.commit();

  return lotId;
}

export async function getLot(lotId: string): Promise<Lot | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'lots', lotId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Lot;
}

export async function getAllLots(): Promise<Lot[]> {
  const q = query(collection(getFirebaseDb(), 'lots'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lot);
}

export async function getLotsByUser(uid: string): Promise<Lot[]> {
  const q = query(
    collection(getFirebaseDb(), 'lots'),
    where('createdByUid', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lot);
}

export async function getLotOrders(lotId: string): Promise<LotOrder[]> {
  const q = query(
    collection(getFirebaseDb(), 'lots', lotId, 'orders'),
    orderBy('orderCode'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LotOrder);
}

export async function startLot(lotId: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'lots', lotId), {
    status: 'IN_PROGRESS' as LotStatus,
    startAt: Timestamp.now(),
  });
}

export async function closeLot(lotId: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'lots', lotId), {
    status: 'CLOSING' as LotStatus,
    endAt: Timestamp.now(),
  });
}

// Fecha o lote para o separador (modo SEPARADOR) - lote fica aguardando bipagem
export async function closeLotForSeparator(lotId: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'lots', lotId), {
    status: 'READY_FOR_SCAN' as LotStatus,
    endAt: Timestamp.now(),
  });
}

// Bipador pega um lote que está aguardando bipagem
export async function claimLotForScanning(
  lotId: string,
  scannerUid: string,
  scannerName: string,
): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'lots', lotId), {
    status: 'CLOSING' as LotStatus,
    scannerUid,
    scannerName,
  });
}

// Busca lotes prontos para bipagem (READY_FOR_SCAN)
export async function getLotsReadyForScan(): Promise<Lot[]> {
  const q = query(
    collection(getFirebaseDb(), 'lots'),
    where('status', '==', 'READY_FOR_SCAN'),
    orderBy('endAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lot);
}

// Busca lotes em bipagem do bipador específico
export async function getLotsByScanner(uid: string): Promise<Lot[]> {
  const q = query(
    collection(getFirebaseDb(), 'lots'),
    where('scannerUid', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lot);
}

export async function startScanning(lotId: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'lots', lotId), {
    scanStartAt: Timestamp.now(),
  });
}

export async function sealOrder(
  lotId: string,
  orderId: string,
  sealedCode: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await runTransaction(getFirebaseDb(), async (transaction) => {
      // Check if seal code already exists globally
      const sealRef = doc(getFirebaseDb(), 'sealedCodes', sealedCode);
      const sealSnap = await transaction.get(sealRef);
      if (sealSnap.exists()) {
        throw new Error(`Lacre ${sealedCode} já foi utilizado no pedido ${sealSnap.data().orderCode}.`);
      }

      const orderRef = doc(getFirebaseDb(), 'lots', lotId, 'orders', orderId);
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) {
        throw new Error('Pedido não encontrado.');
      }
      if (orderSnap.data().status === 'SEALED') {
        throw new Error('Pedido já foi encerrado.');
      }

      const now = Timestamp.now();

      transaction.update(orderRef, {
        status: 'SEALED',
        sealedCode,
        sealedAt: now,
      });

      transaction.set(sealRef, {
        sealedCode,
        orderCode: orderId,
        lotId,
        createdAt: now,
      });
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao encerrar pedido.';
    return { success: false, error: message };
  }
}

export async function completeLot(lotId: string): Promise<void> {
  const lotSnap = await getDoc(doc(getFirebaseDb(), 'lots', lotId));
  if (!lotSnap.exists()) return;

  const lot = lotSnap.data() as Omit<Lot, 'id'>;
  const now = Timestamp.now();

  const startMs = lot.startAt?.toMillis() || 0;
  const endMs = lot.endAt?.toMillis() || Date.now();
  const durationMs = endMs - startMs;

  const scanStartMs = lot.scanStartAt?.toMillis() || endMs;
  const scanEndMs = now.toMillis();
  const scanDurationMs = scanEndMs - scanStartMs;

  const totalDurationMs = scanEndMs - endMs;

  const rules = await getPickingRules();
  const xpResult = calculateLotXp(lot.totals, durationMs, rules);

  // Verificar se é modo separado (SEPARADOR com bipador diferente)
  const isSeparatedMode = lot.workMode === 'SEPARADOR' && lot.scannerUid && lot.separatorUid !== lot.scannerUid;

  if (isSeparatedMode) {
    // Divide XP: 60% para separador, 40% para bipador
    const separatorXp = Math.round(xpResult.total * 0.6);
    const scannerXp = Math.round(xpResult.total * 0.4);

    await updateDoc(doc(getFirebaseDb(), 'lots', lotId), {
      status: 'DONE' as LotStatus,
      xpEarned: xpResult.total,
      separatorXpEarned: separatorXp,
      scannerXpEarned: scannerXp,
      durationMs,
      scanEndAt: now,
      scanDurationMs,
      totalDurationMs,
    });

    // Dar XP para o separador
    if (lot.separatorUid) {
      await incrementUserXp(lot.separatorUid, separatorXp);
      await updateUserStreak(lot.separatorUid);
    }

    // Dar XP para o bipador
    if (lot.scannerUid) {
      await incrementUserXp(lot.scannerUid, scannerXp);
      await updateUserStreak(lot.scannerUid);
    }
  } else {
    // Modo normal (GERAL ou mesmo usuário fez tudo)
    await updateDoc(doc(getFirebaseDb(), 'lots', lotId), {
      status: 'DONE' as LotStatus,
      xpEarned: xpResult.total,
      durationMs,
      scanEndAt: now,
      scanDurationMs,
      totalDurationMs,
    });

    await incrementUserXp(lot.createdByUid, xpResult.total);
    await updateUserStreak(lot.createdByUid);
  }
}

export async function checkAllOrdersSealed(lotId: string): Promise<boolean> {
  const orders = await getLotOrders(lotId);
  return orders.every((o) => o.status === 'SEALED');
}

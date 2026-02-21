import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
  runTransaction,
  writeBatch,
  collectionGroup,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { Lot, LotOrder, LotStatus, LotWorkMode, LotAssignmentType, ParsedOrder } from '@/types';
import { incrementUserXp, updateUserStreak } from './users';
import { getPickingRules } from './pickingRules';
import { calculateLotXp } from '@/lib/xp';

// ==================== FUNCOES DE VALIDACAO ====================

// Verifica se um codigo de lote ja existe
export async function checkLotCodeExists(lotCode: string): Promise<boolean> {
  const lotRef = doc(getFirebaseDb(), 'lots', lotCode);
  const snap = await getDoc(lotRef);
  return snap.exists();
}

// Verifica se um codigo de pedido ja existe em qualquer lote
export async function checkOrderCodeExists(orderCode: string): Promise<{ exists: boolean; lotCode?: string }> {
  try {
    // Buscar em todos os lotes
    const ordersQuery = query(
      collectionGroup(getFirebaseDb(), 'orders'),
      where('orderCode', '==', orderCode),
    );
    const snap = await getDocs(ordersQuery);

    if (!snap.empty) {
      const firstDoc = snap.docs[0];
      const lotId = firstDoc.ref.parent.parent?.id;
      return { exists: true, lotCode: lotId };
    }

    // Buscar em pedidos avulsos
    const singleOrdersQuery = query(
      collection(getFirebaseDb(), 'singleOrders'),
      where('orderCode', '==', orderCode),
    );
    const singleSnap = await getDocs(singleOrdersQuery);

    if (!singleSnap.empty) {
      return { exists: true, lotCode: 'Pedido Avulso' };
    }

    return { exists: false };
  } catch (error) {
    // Se o indice nao existe, pular a verificacao (log para debug)
    console.warn('Erro ao verificar pedido duplicado (indice pode estar faltando):', error);
    return { exists: false };
  }
}

// Verifica multiplos codigos de pedido de uma vez
export async function checkMultipleOrderCodesExist(orderCodes: string[]): Promise<{ code: string; lotCode: string }[]> {
  const duplicates: { code: string; lotCode: string }[] = [];

  for (const code of orderCodes) {
    const result = await checkOrderCodeExists(code);
    if (result.exists && result.lotCode) {
      duplicates.push({ code, lotCode: result.lotCode });
    }
  }

  return duplicates;
}

export async function createLot(
  lotCode: string,
  orders: ParsedOrder[],
  createdByUid: string,
  createdByName: string,
  workMode: LotWorkMode = 'GERAL',
): Promise<string> {
  // Validar se o codigo do lote ja existe
  const lotExists = await checkLotCodeExists(lotCode);
  if (lotExists) {
    throw new Error(`Lote ${lotCode} duplicado! Ja existe no sistema.`);
  }

  // Validar se algum codigo de pedido ja existe
  try {
    const orderCodes = orders.map((o) => o.orderCode);
    const duplicateOrders = await checkMultipleOrderCodesExist(orderCodes);
    if (duplicateOrders.length > 0) {
      const firstDup = duplicateOrders[0];
      throw new Error(`Pedido ${firstDup.code} duplicado! Ja existe no ${firstDup.lotCode}.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicado')) {
      throw error;
    }
    console.warn('Erro ao verificar pedidos duplicados:', error);
  }

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

// Apaga um lote e todos os seus pedidos e lacres associados
export async function deleteLot(lotId: string): Promise<void> {
  const batch = writeBatch(getFirebaseDb());

  // Buscar todos os pedidos do lote
  const ordersSnap = await getDocs(collection(getFirebaseDb(), 'lots', lotId, 'orders'));

  // Deletar lacres associados aos pedidos
  for (const orderDoc of ordersSnap.docs) {
    const orderData = orderDoc.data();
    if (orderData.sealedCode) {
      const sealRef = doc(getFirebaseDb(), 'sealedCodes', orderData.sealedCode);
      batch.delete(sealRef);
    }
    // Deletar o pedido
    batch.delete(orderDoc.ref);
  }

  // Deletar o lote
  batch.delete(doc(getFirebaseDb(), 'lots', lotId));

  await batch.commit();
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
  // Buscar o lote para calcular durationMs
  const lotSnap = await getDoc(doc(getFirebaseDb(), 'lots', lotId));
  if (!lotSnap.exists()) return;

  const lot = lotSnap.data();
  const now = Timestamp.now();
  const startMs = lot.startAt?.toMillis() || 0;
  const endMs = now.toMillis();
  const durationMs = endMs - startMs;

  await updateDoc(doc(getFirebaseDb(), 'lots', lotId), {
    status: 'READY_FOR_SCAN' as LotStatus,
    endAt: now,
    durationMs,
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
  );
  const snap = await getDocs(q);
  const lots = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lot);
  // Ordenar por endAt no cliente (mais antigo primeiro)
  return lots.sort((a, b) => {
    const aTime = a.endAt?.toMillis() || 0;
    const bTime = b.endAt?.toMillis() || 0;
    return aTime - bTime;
  });
}

// Busca lotes em bipagem do bipador específico
export async function getLotsByScanner(uid: string): Promise<Lot[]> {
  const q = query(
    collection(getFirebaseDb(), 'lots'),
    where('scannerUid', '==', uid),
  );
  const snap = await getDocs(q);
  const lots = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lot);
  // Ordenar por createdAt no cliente (mais recente primeiro)
  return lots.sort((a, b) => {
    const aTime = a.createdAt?.toMillis() || 0;
    const bTime = b.createdAt?.toMillis() || 0;
    return bTime - aTime;
  });
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
        throw new Error(`Lacre ${sealedCode} duplicado! Ja foi usado no pedido ${sealSnap.data().orderCode}.`);
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

// ==================== FUNCOES PARA ADMIN ====================

interface AdminLotAssignment {
  assignmentType: LotAssignmentType;
  // Para ASSIGNED_GENERAL
  assignedGeneralUid?: string;
  assignedGeneralName?: string;
  // Para ASSIGNED_SEPARATED
  assignedSeparatorUid?: string;
  assignedSeparatorName?: string;
  assignedScannerUid?: string;
  assignedScannerName?: string;
}

// Cria lote pelo admin com atribuicao de usuarios
export async function createAdminLot(
  lotCode: string,
  orders: ParsedOrder[],
  createdByUid: string,
  createdByName: string,
  assignment: AdminLotAssignment,
): Promise<string> {
  // Validar se o codigo do lote ja existe
  const lotExists = await checkLotCodeExists(lotCode);
  if (lotExists) {
    throw new Error(`Lote ${lotCode} duplicado! Ja existe no sistema.`);
  }

  // Validar se algum codigo de pedido ja existe
  try {
    const orderCodes = orders.map((o) => o.orderCode);
    const duplicateOrders = await checkMultipleOrderCodesExist(orderCodes);
    if (duplicateOrders.length > 0) {
      const firstDup = duplicateOrders[0];
      throw new Error(`Pedido ${firstDup.code} duplicado! Ja existe no ${firstDup.lotCode}.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicado')) {
      throw error;
    }
    console.warn('Erro ao verificar pedidos duplicados:', error);
  }

  const lotId = lotCode;
  const now = Timestamp.now();

  const totalItems = orders.reduce((sum, o) => sum + o.items, 0);
  const cycle = orders[0]?.cycle || '';

  // Determinar workMode baseado no tipo de atribuicao
  let workMode: LotWorkMode = 'GERAL';
  if (assignment.assignmentType === 'ASSIGNED_SEPARATED') {
    workMode = 'SEPARADOR';
  }

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
    isAdminCreated: true,
    assignmentType: assignment.assignmentType,
    // Atribuicoes
    assignedGeneralUid: assignment.assignedGeneralUid || null,
    assignedGeneralName: assignment.assignedGeneralName || null,
    assignedSeparatorUid: assignment.assignedSeparatorUid || null,
    assignedSeparatorName: assignment.assignedSeparatorName || null,
    assignedScannerUid: assignment.assignedScannerUid || null,
    assignedScannerName: assignment.assignedScannerName || null,
    // Se tem separador atribuido, ja preenche separatorUid
    separatorUid: assignment.assignedSeparatorUid || assignment.assignedGeneralUid || null,
    separatorName: assignment.assignedSeparatorName || assignment.assignedGeneralName || null,
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

// Busca lotes atribuidos a um usuario (funcao geral)
export async function getAssignedLotsGeneral(uid: string): Promise<Lot[]> {
  const q = query(
    collection(getFirebaseDb(), 'lots'),
    where('assignedGeneralUid', '==', uid),
  );
  const snap = await getDocs(q);
  const lots = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lot);
  return lots.sort((a, b) => {
    const aTime = a.createdAt?.toMillis() || 0;
    const bTime = b.createdAt?.toMillis() || 0;
    return bTime - aTime;
  });
}

// Busca lotes atribuidos a um usuario (funcao separador)
export async function getAssignedLotsSeparator(uid: string): Promise<Lot[]> {
  const q = query(
    collection(getFirebaseDb(), 'lots'),
    where('assignedSeparatorUid', '==', uid),
  );
  const snap = await getDocs(q);
  const lots = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lot);
  return lots.sort((a, b) => {
    const aTime = a.createdAt?.toMillis() || 0;
    const bTime = b.createdAt?.toMillis() || 0;
    return bTime - aTime;
  });
}

// Busca lotes atribuidos a um usuario (funcao bipador)
export async function getAssignedLotsScanner(uid: string): Promise<Lot[]> {
  const q = query(
    collection(getFirebaseDb(), 'lots'),
    where('assignedScannerUid', '==', uid),
  );
  const snap = await getDocs(q);
  const lots = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lot);
  return lots.sort((a, b) => {
    const aTime = a.createdAt?.toMillis() || 0;
    const bTime = b.createdAt?.toMillis() || 0;
    return bTime - aTime;
  });
}

// Inicia lote atribuido (marca quem esta executando)
export async function startAssignedLot(lotId: string, executorUid: string, executorName: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'lots', lotId), {
    status: 'IN_PROGRESS' as LotStatus,
    startAt: Timestamp.now(),
    separatorUid: executorUid,
    separatorName: executorName,
  });
}

// Bipador assume lote atribuido a ele
export async function startAssignedScanning(lotId: string, scannerUid: string, scannerName: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'lots', lotId), {
    status: 'CLOSING' as LotStatus,
    scannerUid,
    scannerName,
    scanStartAt: Timestamp.now(),
  });
}

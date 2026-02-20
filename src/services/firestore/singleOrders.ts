import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { SingleOrder, SingleOrderStatus } from '@/types';
import { incrementUserXp, updateUserStreak } from './users';
import { getPickingRules } from './pickingRules';
import { checkOrderCodeExists } from './lots';

// Gera um ID unico para o pedido avulso
function generateSingleOrderId(): string {
  return `SO${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// Cria um novo pedido avulso
export async function createSingleOrder(
  orderCode: string,
  items: number,
  createdByUid: string,
  createdByName: string,
): Promise<string> {
  // Validar se o codigo do pedido ja existe
  const orderExists = await checkOrderCodeExists(orderCode);
  if (orderExists.exists) {
    throw new Error(`O pedido ${orderCode} ja existe no ${orderExists.lotCode}.`);
  }

  const id = generateSingleOrderId();
  const now = Timestamp.now();

  await setDoc(doc(getFirebaseDb(), 'singleOrders', id), {
    orderCode,
    items,
    createdByUid,
    createdByName,
    status: 'DRAFT' as SingleOrderStatus,
    createdAt: now,
    separationStartAt: null,
    separationEndAt: null,
    scanStartAt: null,
    scanEndAt: null,
    separationDurationMs: 0,
    scanDurationMs: 0,
    totalDurationMs: 0,
    sealedCode: null,
    xpEarned: 0,
  });

  return id;
}

// Busca um pedido avulso por ID
export async function getSingleOrder(id: string): Promise<SingleOrder | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'singleOrders', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SingleOrder;
}

// Busca pedidos avulsos do usuario
export async function getSingleOrdersByUser(uid: string): Promise<SingleOrder[]> {
  const q = query(
    collection(getFirebaseDb(), 'singleOrders'),
    where('createdByUid', '==', uid),
  );
  const snap = await getDocs(q);
  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SingleOrder);
  // Ordenar por createdAt (mais recente primeiro)
  return orders.sort((a, b) => {
    const aTime = a.createdAt?.toMillis() || 0;
    const bTime = b.createdAt?.toMillis() || 0;
    return bTime - aTime;
  });
}

// Inicia a separacao
export async function startSingleOrderSeparation(id: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'singleOrders', id), {
    status: 'SEPARATING' as SingleOrderStatus,
    separationStartAt: Timestamp.now(),
  });
}

// Finaliza a separacao e prepara para bipagem
export async function endSingleOrderSeparation(id: string): Promise<void> {
  const snap = await getDoc(doc(getFirebaseDb(), 'singleOrders', id));
  if (!snap.exists()) return;

  const order = snap.data();
  const now = Timestamp.now();
  const startMs = order.separationStartAt?.toMillis() || 0;
  const endMs = now.toMillis();
  const separationDurationMs = endMs - startMs;

  await updateDoc(doc(getFirebaseDb(), 'singleOrders', id), {
    status: 'READY_TO_SCAN' as SingleOrderStatus,
    separationEndAt: now,
    separationDurationMs,
  });
}

// Inicia a bipagem
export async function startSingleOrderScanning(id: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'singleOrders', id), {
    status: 'SCANNING' as SingleOrderStatus,
    scanStartAt: Timestamp.now(),
  });
}

// Encerra o pedido avulso com lacre
export async function sealSingleOrder(
  id: string,
  sealedCode: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await runTransaction(getFirebaseDb(), async (transaction) => {
      // Verificar se lacre ja foi usado
      const sealRef = doc(getFirebaseDb(), 'sealedCodes', sealedCode);
      const sealSnap = await transaction.get(sealRef);
      if (sealSnap.exists()) {
        throw new Error(`Lacre ${sealedCode} ja foi utilizado no pedido ${sealSnap.data().orderCode}.`);
      }

      const orderRef = doc(getFirebaseDb(), 'singleOrders', id);
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) {
        throw new Error('Pedido nao encontrado.');
      }

      const order = orderSnap.data();
      if (order.status === 'DONE') {
        throw new Error('Pedido ja foi encerrado.');
      }

      const now = Timestamp.now();
      const scanStartMs = order.scanStartAt?.toMillis() || now.toMillis();
      const scanEndMs = now.toMillis();
      const scanDurationMs = scanEndMs - scanStartMs;

      // Tempo geral = separacao + bipagem
      const separationDurationMs = order.separationDurationMs || 0;
      const totalDurationMs = separationDurationMs + scanDurationMs;

      // Calcular XP (usando mesma formula de lotes, mas para 1 pedido)
      const rules = await getPickingRules();
      const baseXp = rules.xpBasePerLot || 50;
      const orderXp = rules.xpPerOrder || 10;
      const itemXp = (rules.xpPerItem || 2) * order.items;
      let xpTotal = baseXp + orderXp + itemXp;

      // Bonus por velocidade (itens por minuto)
      const totalMinutes = totalDurationMs / 60000;
      const itemsPerMin = totalMinutes > 0 ? order.items / totalMinutes : 0;
      const speedTarget = rules.speedTargetItemsPerMin || 5;

      if (itemsPerMin >= speedTarget * (rules.bonus20Threshold || 1.2)) {
        xpTotal = Math.round(xpTotal * 1.2);
      } else if (itemsPerMin >= speedTarget * (rules.bonus10Threshold || 1.0)) {
        xpTotal = Math.round(xpTotal * 1.1);
      }

      transaction.update(orderRef, {
        status: 'DONE' as SingleOrderStatus,
        sealedCode,
        scanEndAt: now,
        scanDurationMs,
        totalDurationMs,
        xpEarned: xpTotal,
      });

      // Registrar lacre globalmente
      transaction.set(sealRef, {
        sealedCode,
        orderCode: order.orderCode,
        singleOrderId: id,
        createdAt: now,
      });
    });

    // Atribuir XP ao usuario (fora da transacao)
    const updatedOrder = await getSingleOrder(id);
    if (updatedOrder && updatedOrder.xpEarned) {
      await incrementUserXp(updatedOrder.createdByUid, updatedOrder.xpEarned);
      await updateUserStreak(updatedOrder.createdByUid);
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao encerrar pedido.';
    return { success: false, error: message };
  }
}

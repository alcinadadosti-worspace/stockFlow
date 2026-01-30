/**
 * Seed script para criar dados iniciais no Firestore.
 *
 * Uso: npx tsx src/scripts/seed.ts
 *
 * IMPORTANTE: Crie um arquivo .env na raiz com as variáveis do Firebase antes de rodar.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, Timestamp } from 'firebase/firestore';

// Carrega variáveis de ambiente
import 'dotenv/config';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log('Iniciando seed...');
  console.log('Projeto:', firebaseConfig.projectId);

  // 1. Create task types
  const taskTypes = [
    { name: 'Limpeza do Estoque', xp: 100 },
    { name: 'Recebimento de Mercadoria', xp: 150 },
    { name: 'Organização de Prateleiras', xp: 200 },
    { name: 'Endereçamento de Produtos', xp: 150 },
    { name: 'Conferência de Inventário', xp: 250 },
    { name: 'Reposição de Estoque', xp: 120 },
    { name: 'Etiquetagem', xp: 80 },
    { name: 'Separação Avulsa', xp: 100 },
  ];

  console.log('Criando tipos de tarefas...');
  for (const task of taskTypes) {
    await addDoc(collection(db, 'taskTypes'), {
      name: task.name,
      xp: task.xp,
      active: true,
      createdAt: Timestamp.now(),
    });
    console.log(`  ✓ ${task.name} (${task.xp} XP)`);
  }

  // 2. Create default picking rules
  console.log('Criando regras de XP padrão...');
  await setDoc(doc(db, 'pickingRules', 'default'), {
    xpBasePerLot: 50,
    xpPerOrder: 10,
    xpPerItem: 2,
    speedTargetItemsPerMin: 5,
    bonus10Threshold: 1.0,
    bonus20Threshold: 1.2,
    updatedAt: Timestamp.now(),
  });
  console.log('  ✓ Regras de picking criadas');

  console.log('\nSeed concluído com sucesso!');
  console.log('\nPróximos passos:');
  console.log('1. Crie uma conta pelo app (Login > Cadastre-se)');
  console.log('2. No Firebase Console, altere o role do seu usuário para "ADMIN"');
  console.log('   Firestore > users > [seu-uid] > role = "ADMIN"');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Erro no seed:', err);
  process.exit(1);
});

# StockFlow - Produtividade de Estoque

Sistema de gamificação e produtividade para estoquistas. Permite registrar tarefas, importar lotes de separação (picking), encerrar pedidos com leitura de lacre, e acompanhar XP, ranking e métricas.

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript
- **UI:** TailwindCSS + shadcn/ui + Lucide Icons
- **Estado/Forms:** React Hook Form + Zod
- **Tabelas:** TanStack Table
- **Gráficos:** Recharts
- **Upload:** react-dropzone + SheetJS (xlsx)
- **Backend:** Firebase (Firestore + Auth)
- **Timezone:** America/Maceio

## Setup

### 1. Criar Projeto Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto
3. Ative **Authentication** > método **Email/Senha**
4. Ative **Cloud Firestore** (modo de teste ou produção)
5. Em **Configurações do projeto**, copie as credenciais do Web App

### 2. Configurar Variáveis de Ambiente

Copie `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Preencha com as credenciais do Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=sua_chave
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_projeto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id
```

### 3. Aplicar Firestore Security Rules

No Firebase Console > Firestore > Regras, cole o conteúdo de `firestore.rules`.

### 4. Instalar e Rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

### 5. Seed (dados iniciais)

Para popular tarefas e regras de XP padrão:

```bash
npm run seed
```

> Requer que `.env.local` esteja configurado. O script usa `dotenv`.

### 6. Primeiro Admin

1. Crie uma conta pelo app (Login > Cadastre-se)
2. No Firebase Console, vá em Firestore > `users` > seu documento
3. Altere o campo `role` de `"ESTOQUISTA"` para `"ADMIN"`

### 7. Deploy no Render

1. Faça push do código para o GitHub
2. No Render, crie um **Web Service** com:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
3. Adicione as variáveis de ambiente do Firebase
4. Deploy!

Ou na **Vercel**:
1. Importe o repositório
2. Adicione as variáveis de ambiente
3. Deploy automático

## Estrutura de Pastas

```
src/
├── app/
│   ├── (auth)/login/          # Página de login/cadastro
│   ├── (dashboard)/
│   │   ├── dashboard/         # Dashboard principal
│   │   ├── leaderboard/       # Ranking
│   │   ├── tarefas/           # Registrar tarefas
│   │   ├── lotes/             # Listar e importar lotes
│   │   │   └── [lotId]/       # Detalhe do lote (iniciar/fechar/encerrar)
│   │   └── admin/
│   │       ├── tarefas/       # CRUD tipos de tarefas
│   │       ├── regras-xp/     # Configurar XP do picking
│   │       ├── usuarios/      # Gerenciar roles
│   │       └── relatorios/    # Relatórios gerais
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx               # Redirect para dashboard ou login
│   └── providers.tsx
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── layout/                # Sidebar, Header
│   └── lotes/                 # ImportLotDialog
├── hooks/
│   ├── useAuth.tsx            # Auth context + provider
│   ├── useRequireAuth.ts
│   └── useRequireAdmin.ts
├── lib/
│   ├── firebase.ts            # Config Firebase
│   ├── utils.ts               # cn(), formatDate, calculateLevel
│   ├── constants.ts           # Status labels, badges, defaults
│   ├── schemas.ts             # Zod schemas + validações
│   ├── xp.ts                  # Cálculo de XP
│   └── spreadsheet.ts         # Parse CSV/XLSX
├── services/firestore/
│   ├── users.ts
│   ├── taskTypes.ts
│   ├── taskLogs.ts
│   ├── pickingRules.ts
│   ├── lots.ts
│   └── index.ts
├── types/
│   └── index.ts
├── scripts/
│   └── seed.ts                # Script de seed
└── __tests__/
    ├── xp.test.ts
    ├── validation.test.ts
    └── spreadsheet.test.ts
```

## Modelo Firestore

| Coleção | Documento | Campos |
|---------|-----------|--------|
| `users/{uid}` | Usuário | name, email, role, xpTotal, streak, lastActivityDate, createdAt |
| `taskTypes/{id}` | Tipo de tarefa | name, xp, active, createdAt |
| `taskLogs/{id}` | Registro de tarefa | uid, userName, taskTypeId, taskTypeName, xp, quantity, note, occurredAt, createdAt |
| `pickingRules/default` | Regras de XP | xpBasePerLot, xpPerOrder, xpPerItem, speedTargetItemsPerMin, bonus10Threshold, bonus20Threshold |
| `lots/{lotCode}` | Lote | lotCode, createdByUid, createdByName, status, cycle, startAt, endAt, totals, xpEarned, durationMs |
| `lots/{lotCode}/orders/{orderCode}` | Pedido | orderCode, cycle, approvedAt, items, status, sealedCode, sealedAt |
| `sealedCodes/{code}` | Lacre único | sealedCode, orderCode, lotId, createdAt |

## Fluxo do Lote

1. **Importar** planilha (CSV/XLSX) com pedidos → Status: `DRAFT`
2. **Iniciar** lote (sai para buscar itens) → Status: `IN_PROGRESS` + timestamp start
3. **Fechar** lote (retornou com itens) → Status: `CLOSING` + timestamp end
4. **Encerrar pedidos** um a um com código de lacre (10 dígitos, barcode reader)
5. Todos encerrados → Status: `DONE` + cálculo de XP

## Cálculo de XP (Picking)

```
XP = base + (xpPerOrder × pedidos) + (xpPerItem × itens) + bônus
```

- **Bônus 10%:** velocidade >= meta
- **Bônus 20%:** velocidade >= meta × 1.2
- Velocidade = itens / minutos

## Testes

```bash
npm test              # Rodar testes uma vez
npm run test:watch    # Watch mode
```

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Rodar em desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Iniciar produção |
| `npm run lint` | Lint |
| `npm run format` | Formatar código |
| `npm test` | Rodar testes |
| `npm run seed` | Popular dados iniciais |

## Checklist de QA

### Autenticação
- [ ] Criar conta com email/senha
- [ ] Login com credenciais válidas
- [ ] Erro ao logar com credenciais inválidas
- [ ] Redirect para /login quando não autenticado
- [ ] Logout funciona corretamente

### Tarefas (Estoquista)
- [ ] Ver catálogo de tarefas ativas
- [ ] Registrar tarefa com quantidade
- [ ] XP calculado corretamente (xp × quantidade)
- [ ] Histórico mostra tarefas registradas
- [ ] XP atualizado no header

### Lotes (Estoquista)
- [ ] Importar planilha XLSX com colunas corretas
- [ ] Importar planilha CSV
- [ ] Erro amigável se colunas faltarem
- [ ] Preview mostra primeiras 20 linhas
- [ ] Criar lote com código de 8 dígitos
- [ ] Iniciar lote (timestamp start)
- [ ] Fechar lote (timestamp end)
- [ ] Encerrar pedidos com lacre de 10 dígitos
- [ ] Lacre duplicado é rejeitado (global)
- [ ] Auto-focus no campo de lacre
- [ ] Enter confirma o lacre
- [ ] Barra de progresso atualiza
- [ ] Confetti ao concluir todos os pedidos
- [ ] XP calculado e atribuído ao completar

### Leaderboard
- [ ] Ranking mostra todos os usuários
- [ ] Filtro por período funciona
- [ ] Destaque no próprio usuário

### Admin
- [ ] CRUD de tipos de tarefas
- [ ] Ativar/desativar tarefa
- [ ] Editar regras de XP do picking
- [ ] Visualizar todos os usuários
- [ ] Alterar role de usuário
- [ ] Relatórios com gráficos
- [ ] Filtro por usuário nos relatórios

### Gamificação
- [ ] Level calculado corretamente
- [ ] Barra de progresso do level
- [ ] Streak incrementa em dias consecutivos
- [ ] Streak reseta ao pular dia
- [ ] Badges exibidos no dashboard

### UX
- [ ] Dark mode toggle funciona
- [ ] Sidebar colapsa/expande
- [ ] Responsivo em telas menores
- [ ] Loading states (skeletons)
- [ ] Toasts de feedback

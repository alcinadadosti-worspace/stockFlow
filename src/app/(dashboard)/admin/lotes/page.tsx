'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getAllLots, createAdminLot, deleteLot } from '@/services/firestore/lots';
import { getAllUsers } from '@/services/firestore/users';
import { parseSpreadsheet } from '@/lib/spreadsheet';
import type { Lot, AppUser, ParsedOrder, LotAssignmentType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Plus,
  Clock,
  CheckCircle2,
  Loader2,
  FileEdit,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Hourglass,
  Users,
  User,
  Layers,
  ScanLine,
  Trash2,
} from 'lucide-react';
import { formatDateTimeBR, formatDuration } from '@/lib/utils';
import { LOT_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

function getStatusColor(status: string) {
  switch (status) {
    case 'DRAFT': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    case 'IN_PROGRESS': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'READY_FOR_SCAN': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'CLOSING': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'DONE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    default: return '';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'DRAFT': return <FileEdit className="h-3 w-3" />;
    case 'IN_PROGRESS': return <Loader2 className="h-3 w-3 animate-spin" />;
    case 'READY_FOR_SCAN': return <Hourglass className="h-3 w-3" />;
    case 'CLOSING': return <Clock className="h-3 w-3" />;
    case 'DONE': return <CheckCircle2 className="h-3 w-3" />;
    default: return null;
  }
}

export default function AdminLotesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [step, setStep] = useState<'upload' | 'config' | 'saving'>('upload');
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [assignmentType, setAssignmentType] = useState<LotAssignmentType>('OPEN');
  const [assignedGeneralUid, setAssignedGeneralUid] = useState('');
  const [assignedSeparatorUid, setAssignedSeparatorUid] = useState('');
  const [assignedScannerUid, setAssignedScannerUid] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lotsData, usersData] = await Promise.all([
        getAllLots(),
        getAllUsers(),
      ]);
      setLots(lotsData);
      // Filtrar apenas estoquistas e admins ativos
      setUsers(usersData);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const result = parseSpreadsheet(buffer, file.name);

    if (result.errors.length > 0) {
      setErrors(result.errors);
    } else {
      setErrors([]);
    }

    if (result.orders.length > 0) {
      setOrders(result.orders);
      setStep('config');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  function resetForm() {
    setStep('upload');
    setOrders([]);
    setErrors([]);
    setFileName('');
    setLotCode('');
    setAssignmentType('OPEN');
    setAssignedGeneralUid('');
    setAssignedSeparatorUid('');
    setAssignedScannerUid('');
  }

  async function handleCreate() {
    if (!user || orders.length === 0) return;
    if (!lotCode.trim() || !/^\d{8}$/.test(lotCode.trim())) {
      toast.error('Codigo do lote deve ter 8 digitos');
      return;
    }

    // Validar atribuicoes
    if (assignmentType === 'ASSIGNED_GENERAL' && !assignedGeneralUid) {
      toast.error('Selecione um usuario para a funcao geral');
      return;
    }
    if (assignmentType === 'ASSIGNED_SEPARATED') {
      if (!assignedSeparatorUid) {
        toast.error('Selecione um usuario separador');
        return;
      }
      if (!assignedScannerUid) {
        toast.error('Selecione um usuario bipador');
        return;
      }
    }

    setSaving(true);
    setStep('saving');

    try {
      const generalUser = users.find((u) => u.uid === assignedGeneralUid);
      const separatorUser = users.find((u) => u.uid === assignedSeparatorUid);
      const scannerUser = users.find((u) => u.uid === assignedScannerUid);

      await createAdminLot(
        lotCode.trim(),
        orders,
        user.uid,
        user.name,
        {
          assignmentType,
          assignedGeneralUid: assignedGeneralUid || undefined,
          assignedGeneralName: generalUser?.name,
          assignedSeparatorUid: assignedSeparatorUid || undefined,
          assignedSeparatorName: separatorUser?.name,
          assignedScannerUid: assignedScannerUid || undefined,
          assignedScannerName: scannerUser?.name,
        },
      );

      toast.success('Lote criado com sucesso!');
      setShowCreate(false);
      resetForm();
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar lote';
      toast.error(message);
      setStep('config');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(lotId: string, lotCode: string) {
    if (!confirm(`Tem certeza que deseja apagar o lote ${lotCode}? Esta acao nao pode ser desfeita.`)) {
      return;
    }

    setDeleting(lotId);
    try {
      await deleteLot(lotId);
      toast.success(`Lote ${lotCode} apagado!`);
      loadData();
    } catch (err) {
      toast.error('Erro ao apagar lote');
      console.error(err);
    } finally {
      setDeleting(null);
    }
  }

  const estoquistas = users.filter((u) => u.role === 'ESTOQUISTA');
  const allAssignableUsers = users; // Admins tambem podem ser atribuidos

  // Estatisticas
  const adminLots = lots.filter((l) => l.isAdminCreated);
  const inProgress = lots.filter((l) => ['IN_PROGRESS', 'READY_FOR_SCAN', 'CLOSING'].includes(l.status)).length;
  const done = lots.filter((l) => l.status === 'DONE').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerenciar Lotes</h1>
          <p className="text-sm text-muted-foreground">
            Crie lotes e atribua usuarios para execucao
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Criar Lote
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{lots.length}</div>
            <p className="text-xs text-muted-foreground">Total de Lotes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-violet-500">{adminLots.length}</div>
            <p className="text-xs text-muted-foreground">Criados por Admin</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{inProgress}</div>
            <p className="text-xs text-muted-foreground">Em Andamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-500">{done}</div>
            <p className="text-xs text-muted-foreground">Concluidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Lots List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Todos os Lotes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : lots.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum lote encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lots.map((lot) => (
                <div
                  key={lot.id}
                  className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50"
                  onClick={() => router.push(`/lotes/${lot.id}`)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{lot.lotCode}</span>
                      <Badge className={cn('gap-1', getStatusColor(lot.status))}>
                        {getStatusIcon(lot.status)}
                        {LOT_STATUS_LABELS[lot.status]}
                      </Badge>
                      {lot.isAdminCreated && (
                        <Badge variant="outline" className="text-violet-500 border-violet-500/30">
                          Admin
                        </Badge>
                      )}
                      {lot.assignmentType === 'ASSIGNED_GENERAL' && (
                        <Badge variant="outline" className="text-blue-500 border-blue-500/30 gap-1">
                          <User className="h-3 w-3" />
                          {lot.assignedGeneralName}
                        </Badge>
                      )}
                      {lot.assignmentType === 'ASSIGNED_SEPARATED' && (
                        <>
                          <Badge variant="outline" className="text-blue-500 border-blue-500/30 gap-1">
                            <Package className="h-3 w-3" />
                            {lot.assignedSeparatorName}
                          </Badge>
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30 gap-1">
                            <ScanLine className="h-3 w-3" />
                            {lot.assignedScannerName}
                          </Badge>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lot.totals?.orders || 0} pedidos &middot; {lot.totals?.items || 0} itens
                      {lot.cycle && ` · Ciclo ${lot.cycle}`}
                      {` · por ${lot.createdByName}`}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">
                      {lot.createdAt ? formatDateTimeBR(lot.createdAt.toDate()) : '-'}
                    </p>
                    {lot.durationMs && lot.durationMs > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Duracao: {formatDuration(lot.durationMs)}
                      </p>
                    )}
                    {lot.xpEarned && lot.xpEarned > 0 && (
                      <Badge variant="outline" className="mt-1 text-amber-500">
                        +{lot.xpEarned} XP
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(lot.id, lot.lotCode);
                    }}
                    disabled={deleting === lot.id}
                  >
                    {deleting === lot.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Lote (Admin)</DialogTitle>
            <DialogDescription>
              Importe uma planilha e atribua usuarios para executar o lote
            </DialogDescription>
          </DialogHeader>

          {step === 'upload' && (
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50',
                )}
              >
                <input {...getInputProps()} />
                <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-sm font-medium">Solte o arquivo aqui...</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">
                      Arraste e solte o arquivo aqui
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ou clique para selecionar (CSV, XLSX)
                    </p>
                  </>
                )}
              </div>

              {errors.length > 0 && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Erros na importacao</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'config' && (
            <div className="space-y-6">
              {/* File info */}
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {orders.length} pedidos &middot; {orders.reduce((s, o) => s + o.items, 0)} itens
                  </p>
                </div>
              </div>

              {/* Lot code */}
              <div className="space-y-2">
                <Label>Codigo do Lote (8 digitos)</Label>
                <Input
                  placeholder="12345678"
                  maxLength={8}
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="font-mono"
                />
              </div>

              {/* Assignment type */}
              <div className="space-y-3">
                <Label>Tipo de Atribuicao</Label>
                <RadioGroup
                  value={assignmentType}
                  onValueChange={(v) => setAssignmentType(v as LotAssignmentType)}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="OPEN" id="open" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="open" className="font-medium cursor-pointer">
                        Aberto
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Qualquer estoquista pode pegar este lote
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="ASSIGNED_GENERAL" id="general" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="general" className="font-medium cursor-pointer flex items-center gap-2">
                        <Layers className="h-4 w-4 text-violet-500" />
                        Funcao Completa
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Um usuario faz todo o processo (separar + bipar + lacrar)
                      </p>
                      {assignmentType === 'ASSIGNED_GENERAL' && (
                        <Select value={assignedGeneralUid} onValueChange={setAssignedGeneralUid}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Selecione o usuario" />
                          </SelectTrigger>
                          <SelectContent>
                            {allAssignableUsers.map((u) => (
                              <SelectItem key={u.uid} value={u.uid}>
                                {u.name} {u.role === 'ADMIN' && '(Admin)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="ASSIGNED_SEPARATED" id="separated" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="separated" className="font-medium cursor-pointer flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        Funcoes Separadas
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Um usuario separa e outro bipa/lacra
                      </p>
                      {assignmentType === 'ASSIGNED_SEPARATED' && (
                        <div className="mt-3 space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              <Package className="h-3 w-3 text-blue-500" />
                              Separador
                            </Label>
                            <Select value={assignedSeparatorUid} onValueChange={setAssignedSeparatorUid}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o separador" />
                              </SelectTrigger>
                              <SelectContent>
                                {allAssignableUsers.map((u) => (
                                  <SelectItem key={u.uid} value={u.uid}>
                                    {u.name} {u.role === 'ADMIN' && '(Admin)'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              <ScanLine className="h-3 w-3 text-amber-500" />
                              Bipador
                            </Label>
                            <Select value={assignedScannerUid} onValueChange={setAssignedScannerUid}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o bipador" />
                              </SelectTrigger>
                              <SelectContent>
                                {allAssignableUsers.map((u) => (
                                  <SelectItem key={u.uid} value={u.uid}>
                                    {u.name} {u.role === 'ADMIN' && '(Admin)'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => { setStep('upload'); setOrders([]); }}>
                  Voltar
                </Button>
                <Button className="flex-1" onClick={handleCreate} disabled={saving}>
                  {saving ? 'Criando...' : 'Criar Lote'}
                </Button>
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">
                Criando lote com {orders.length} pedidos...
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

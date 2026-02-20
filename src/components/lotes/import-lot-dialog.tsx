'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { lotImportSchema, type LotImportForm } from '@/lib/schemas';
import { parseSpreadsheet } from '@/lib/spreadsheet';
import { createLot } from '@/services/firestore/lots';
import { useAuth } from '@/hooks/useAuth';
import type { LotWorkMode, ParsedOrder } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImportLotDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workMode?: LotWorkMode;
}

export function ImportLotDialog({ open, onClose, onSuccess, workMode = 'GERAL' }: ImportLotDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'upload' | 'preview' | 'saving'>('upload');
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);

  const form = useForm<LotImportForm>({
    resolver: zodResolver(lotImportSchema),
    defaultValues: { lotCode: '' },
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const result = parseSpreadsheet(buffer, file.name);

    if (result.errors.length > 0) {
      setErrors(result.errors);
      setOrders(result.orders);
      if (result.orders.length > 0) {
        setStep('preview');
      }
    } else {
      setErrors([]);
      setOrders(result.orders);
      setStep('preview');
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

  async function handleConfirm(data: LotImportForm) {
    if (!user || orders.length === 0) return;
    setSaving(true);
    setStep('saving');
    try {
      await createLot(data.lotCode, orders, user.uid, user.name, workMode);
      toast.success('Lote importado com sucesso!', {
        description: `${orders.length} pedidos importados.`,
      });
      resetState();
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar lote';
      toast.error(message);
      setStep('preview');
    } finally {
      setSaving(false);
    }
  }

  function resetState() {
    setStep('upload');
    setOrders([]);
    setErrors([]);
    setFileName('');
    form.reset();
  }

  function handleClose() {
    resetState();
    onClose();
  }

  const totalItems = orders.reduce((sum, o) => sum + o.items, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Lote</DialogTitle>
          <DialogDescription>
            Importe uma planilha CSV ou XLSX com os pedidos do lote
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

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Colunas esperadas na planilha:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">Pedido</Badge>
                <Badge variant="secondary">Ciclo</Badge>
                <Badge variant="secondary">Data de Aprovação</Badge>
                <Badge variant="secondary">Itens</Badge>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Erros na importação</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {errors.map((err, i) => (
                    <li key={i} className="text-xs text-destructive/80">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3">
              <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {orders.length} pedidos &middot; {totalItems} itens
                </p>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {errors.length} linha(s) com erro foram ignoradas.
                </p>
              </div>
            )}

            <form onSubmit={form.handleSubmit(handleConfirm)} className="space-y-4">
              <div className="space-y-2">
                <Label>Código do Lote (8 dígitos)</Label>
                <Input
                  placeholder="12345678"
                  maxLength={8}
                  {...form.register('lotCode')}
                />
                {form.formState.errors.lotCode && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.lotCode.message}
                  </p>
                )}
              </div>

              {/* Preview table */}
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Pedido</th>
                      <th className="px-3 py-2 text-left font-medium">Ciclo</th>
                      <th className="px-3 py-2 text-left font-medium">Data Aprovação</th>
                      <th className="px-3 py-2 text-right font-medium">Itens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 20).map((o, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 font-mono">{o.orderCode}</td>
                        <td className="px-3 py-2">{o.cycle}</td>
                        <td className="px-3 py-2">
                          {o.approvedAt
                            ? o.approvedAt.toLocaleDateString('pt-BR')
                            : '-'}
                        </td>
                        <td className="px-3 py-2 text-right">{o.items}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orders.length > 20 && (
                  <p className="border-t p-2 text-center text-xs text-muted-foreground">
                    Mostrando 20 de {orders.length} pedidos
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStep('upload');
                    setOrders([]);
                    setErrors([]);
                  }}
                >
                  Voltar
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? 'Salvando...' : 'Confirmar Importação'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">
              Salvando {orders.length} pedidos...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

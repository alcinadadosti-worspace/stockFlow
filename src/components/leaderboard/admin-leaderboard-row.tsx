'use client';

import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';
import type { AdminLeaderboardEntry } from '@/types';
import { Timer, Package, ScanLine, Clock, Boxes, ClipboardCheck, Gauge, ListChecks } from 'lucide-react';

interface AdminLeaderboardRowProps {
  entry: AdminLeaderboardEntry;
}

export function AdminLeaderboardRow({ entry }: AdminLeaderboardRowProps) {
  const taskBreakdownEntries = Object.entries(entry.taskBreakdown).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="rounded-lg border bg-muted/30 p-4 mt-2 mb-1 space-y-4">
      {/* Chronometer Averages */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Tempos Médios por Lote
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
            <Package className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Separação</p>
            <p className="text-sm font-bold font-mono text-blue-500">
              {entry.avgPickingMs > 0 ? formatDuration(entry.avgPickingMs) : '--'}
            </p>
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-center">
            <ScanLine className="h-4 w-4 text-amber-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Bipagem</p>
            <p className="text-sm font-bold font-mono text-amber-500">
              {entry.avgScanningMs > 0 ? formatDuration(entry.avgScanningMs) : '--'}
            </p>
          </div>
          <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-3 text-center">
            <Clock className="h-4 w-4 text-violet-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-sm font-bold font-mono text-violet-500">
              {entry.avgTotalMs > 0 ? formatDuration(entry.avgTotalMs) : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Productivity Metrics */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Produtividade
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <Boxes className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-bold">{entry.itemsSeparated}</p>
            <p className="text-xs text-muted-foreground">Itens separados</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-bold">{entry.ordersSealed}</p>
            <p className="text-xs text-muted-foreground">Pedidos bipados</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <Gauge className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-bold">{entry.itemsPerMinute.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Itens/min</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <Timer className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-bold">{entry.ordersPerHour.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Pedidos/hora</p>
          </div>
        </div>
      </div>

      {/* Task Breakdown */}
      {taskBreakdownEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Tarefas Realizadas
          </p>
          <div className="flex flex-wrap gap-2">
            {taskBreakdownEntries.map(([name, count]) => (
              <Badge key={name} variant="secondary" className="text-xs">
                <ListChecks className="mr-1 h-3 w-3" />
                {name}: {count}x
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

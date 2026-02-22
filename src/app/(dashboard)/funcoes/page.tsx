'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, ScanLine, Layers, ClipboardList } from 'lucide-react';
import { OperatorSelectDialog } from '@/components/operators/operator-select-dialog';

type FunctionType = 'lotes' | 'separador' | 'bipador' | 'pedido-avulso' | null;

const FUNCTION_TITLES: Record<string, string> = {
  'lotes': 'Funcao Completa',
  'separador': 'Separador',
  'bipador': 'Bipador',
  'pedido-avulso': 'Pedido Avulso',
};

export default function FuncoesPage() {
  const [selectedFunction, setSelectedFunction] = useState<FunctionType>(null);

  function handleCardClick(func: FunctionType) {
    setSelectedFunction(func);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Selecionar Funcao</h1>
        <p className="text-sm text-muted-foreground">
          Escolha qual funcao voce vai exercer hoje
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Funcao Geral */}
        <Card
          className="cursor-pointer transition-all hover:border-primary hover:shadow-lg hover:scale-105 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '0ms' }}
          onClick={() => handleCardClick('lotes')}
        >
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10 transition-transform group-hover:scale-110">
              <Layers className="h-8 w-8 text-violet-500" />
            </div>
            <CardTitle>Funcao Completa</CardTitle>
            <CardDescription>
              Separar itens + Bipar pedidos + Lacrar caixas
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Voce faz todo o processo do lote, desde a separacao ate o encerramento dos pedidos.
            </p>
            <Button className="w-full bg-violet-500 hover:bg-violet-600">
              Acessar
            </Button>
          </CardContent>
        </Card>

        {/* Funcao Separador */}
        <Card
          className="cursor-pointer transition-all hover:border-primary hover:shadow-lg hover:scale-105 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '100ms' }}
          onClick={() => handleCardClick('separador')}
        >
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
              <Package className="h-8 w-8 text-blue-500" />
            </div>
            <CardTitle>Separador</CardTitle>
            <CardDescription>
              Apenas separar os itens do lote
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Voce importa o lote, separa os itens no estoque e deixa pronto para o bipador.
            </p>
            <Button className="w-full bg-blue-500 hover:bg-blue-600">
              Acessar
            </Button>
          </CardContent>
        </Card>

        {/* Funcao Bipador */}
        <Card
          className="cursor-pointer transition-all hover:border-primary hover:shadow-lg hover:scale-105 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '200ms' }}
          onClick={() => handleCardClick('bipador')}
        >
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
              <ScanLine className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle>Bipador</CardTitle>
            <CardDescription>
              Apenas bipar pedidos e lacrar caixas
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Voce pega lotes ja separados e faz a bipagem dos pedidos e lacracao das caixas.
            </p>
            <Button className="w-full bg-amber-500 hover:bg-amber-600">
              Acessar
            </Button>
          </CardContent>
        </Card>

        {/* Pedido Avulso */}
        <Card
          className="cursor-pointer transition-all hover:border-primary hover:shadow-lg hover:scale-105 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '300ms' }}
          onClick={() => handleCardClick('pedido-avulso')}
        >
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <ClipboardList className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>Pedido Avulso</CardTitle>
            <CardDescription>
              Processar um pedido individual
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Processe um unico pedido com separacao, bipagem e lacracao completa.
            </p>
            <Button className="w-full bg-green-500 hover:bg-green-600">
              Acessar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Modal de seleção de operador */}
      <OperatorSelectDialog
        open={selectedFunction !== null}
        onClose={() => setSelectedFunction(null)}
        redirectTo={`/${selectedFunction}`}
        title={selectedFunction ? FUNCTION_TITLES[selectedFunction] : 'Identificação'}
      />
    </div>
  );
}

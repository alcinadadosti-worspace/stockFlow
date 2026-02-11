'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Boxes, ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function handleSubmit(data: ForgotPasswordForm) {
    setLoading(true);
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), data.email);
      setEmailSent(true);
      toast.success('Email de recuperação enviado!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar email';
      if (message.includes('user-not-found')) {
        toast.error('Nenhuma conta encontrada com este email.');
      } else if (message.includes('too-many-requests')) {
        toast.error('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        toast.error('Erro ao enviar email de recuperação.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex items-center gap-2">
            <Boxes className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">StockFlow</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Sistema de Produtividade e Gamificação
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recuperar Senha</CardTitle>
            <CardDescription>
              {emailSent
                ? 'Verifique sua caixa de entrada'
                : 'Digite seu email para receber o link de recuperação'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailSent ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Enviamos um email para <strong>{form.getValues('email')}</strong> com
                      instruções para redefinir sua senha.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setEmailSent(false)}
                >
                  Enviar novamente
                </Button>
              </div>
            ) : (
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    {...form.register('email')}
                  />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                </Button>
              </form>
            )}
            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar para o login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

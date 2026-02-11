'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, registerSchema, type LoginForm, type RegisterForm } from '@/lib/schemas';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Boxes } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  async function handleLogin(data: LoginForm) {
    setLoading(true);
    try {
      await signIn(data.email, data.password);
      router.push('/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao fazer login';
      if (message.includes('invalid-credential') || message.includes('wrong-password') || message.includes('user-not-found')) {
        toast.error('Email ou senha incorretos.');
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(data: RegisterForm) {
    setLoading(true);
    try {
      await signUp(data.email, data.password, data.name);
      toast.success('Conta criada com sucesso!');
      router.push('/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar conta';
      if (message.includes('email-already-in-use')) {
        toast.error('Este email já está em uso.');
      } else {
        toast.error(message);
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

        {!isRegister ? (
          <Card>
            <CardHeader>
              <CardTitle>Entrar</CardTitle>
              <CardDescription>
                Acesse sua conta para continuar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={loginForm.handleSubmit(handleLogin)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    {...loginForm.register('email')}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••"
                    {...loginForm.register('password')}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                  <div className="text-right">
                    <Link
                      href="/forgot-password"
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline hover:text-foreground"
                  onClick={() => setIsRegister(true)}
                >
                  Não tem conta? Cadastre-se
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Criar Conta</CardTitle>
              <CardDescription>
                Preencha os dados para se cadastrar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={registerForm.handleSubmit(handleRegister)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Seu nome"
                    {...registerForm.register('name')}
                  />
                  {registerForm.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {registerForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="seu@email.com"
                    {...registerForm.register('email')}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Senha</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="••••••"
                    {...registerForm.register('password')}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-xs text-destructive">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••"
                    {...registerForm.register('confirmPassword')}
                  />
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive">
                      {registerForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Criando...' : 'Criar Conta'}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline hover:text-foreground"
                  onClick={() => setIsRegister(false)}
                >
                  Já tem conta? Entrar
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

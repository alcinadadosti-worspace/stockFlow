'use client';

import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/hooks/useAuth';
import { SoundProvider } from '@/hooks/useSound';
import { OperatorProvider } from '@/hooks/useOperator';
import { FilialProvider } from '@/hooks/useFilial';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <FilialProvider>
          <OperatorProvider>
            <SoundProvider>
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  style: {
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--card-foreground))',
                    border: '1px solid hsl(var(--border))',
                  },
                }}
              />
            </SoundProvider>
          </OperatorProvider>
        </FilialProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

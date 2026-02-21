'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';

// Tipos de som disponíveis
export type SoundType =
  | 'success'
  | 'error'
  | 'lot-created'
  | 'lot-started'
  | 'lot-finished'
  | 'scan-start'
  | 'scan-complete'
  | 'click';

const STORAGE_KEY = 'stockflow-sound-enabled';

interface SoundContextValue {
  soundEnabled: boolean;
  toggleSound: () => void;
  playSound: (type: SoundType) => void;
}

const SoundContext = createContext<SoundContextValue | undefined>(undefined);

// Gera sons usando Web Audio API
function createSound(audioContext: AudioContext, type: SoundType): void {
  const now = audioContext.currentTime;

  switch (type) {
    case 'success': {
      // Som de sucesso: duas notas ascendentes
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.frequency.setValueAtTime(659.25, now + 0.1); // E5

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioContext.destination);

      osc1.start(now);
      osc1.stop(now + 0.15);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.3);
      break;
    }

    case 'error': {
      // Som de erro: tom descendente
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(now);
      osc.stop(now + 0.3);
      break;
    }

    case 'lot-created': {
      // Ding suave
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(now);
      osc.stop(now + 0.5);
      break;
    }

    case 'lot-started': {
      // Whoosh ascendente
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.setValueAtTime(0.3, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(now);
      osc.stop(now + 0.4);
      break;
    }

    case 'lot-finished': {
      // Fanfarra: acorde maior
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
      const gains: GainNode[] = [];
      const oscs: OscillatorNode[] = [];

      frequencies.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.05 + i * 0.05);
        gain.gain.setValueAtTime(0.2, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

        osc.connect(gain);
        gain.connect(audioContext.destination);

        oscs.push(osc);
        gains.push(gain);
      });

      oscs.forEach((osc) => {
        osc.start(now);
        osc.stop(now + 0.8);
      });
      break;
    }

    case 'scan-start': {
      // Beep de scanner
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1000, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.setValueAtTime(0.15, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }

    case 'scan-complete': {
      // Chime de conclusao
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(784, now); // G5
      osc2.frequency.setValueAtTime(1047, now + 0.15); // C6

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioContext.destination);

      osc1.start(now);
      osc1.stop(now + 0.2);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.5);
      break;
    }

    case 'click': {
      // Click curto
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(now);
      osc.stop(now + 0.05);
      break;
    }
  }
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Verificar se estamos no cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Carregar preferencia do localStorage
  useEffect(() => {
    if (!isClient) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setSoundEnabled(stored === 'true');
    }
  }, [isClient]);

  // Inicializar AudioContext na primeira interacao
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    // Resumir se estiver suspenso (necessario em alguns browsers)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const newValue = !prev;
      if (isClient) {
        localStorage.setItem(STORAGE_KEY, String(newValue));
      }
      return newValue;
    });
  }, [isClient]);

  const playSound = useCallback(
    (type: SoundType) => {
      if (!soundEnabled || !isClient) return;

      try {
        const audioContext = getAudioContext();
        createSound(audioContext, type);
      } catch (error) {
        // Silenciosamente falha se nao conseguir tocar
        console.warn('Erro ao tocar som:', error);
      }
    },
    [soundEnabled, isClient, getAudioContext]
  );

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound, playSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound(): SoundContextValue {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error('useSound deve ser usado dentro de um SoundProvider');
  }
  return context;
}

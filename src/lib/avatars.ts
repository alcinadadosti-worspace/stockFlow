// Avatares estilo Xbox Game Pass
// Cores vibrantes e designs modernos

export interface Avatar {
  id: string;
  name: string;
  emoji: string; // Usamos emojis como avatares para simplicidade
  bgColor: string; // Cor de fundo do avatar
}

export const AVATARS: Avatar[] = [
  // Animais
  { id: 'wolf', name: 'Lobo', emoji: '🐺', bgColor: 'bg-slate-600' },
  { id: 'lion', name: 'Leao', emoji: '🦁', bgColor: 'bg-amber-500' },
  { id: 'eagle', name: 'Aguia', emoji: '🦅', bgColor: 'bg-sky-600' },
  { id: 'dragon', name: 'Dragao', emoji: '🐉', bgColor: 'bg-red-600' },
  { id: 'tiger', name: 'Tigre', emoji: '🐯', bgColor: 'bg-orange-500' },
  { id: 'bear', name: 'Urso', emoji: '🐻', bgColor: 'bg-amber-700' },
  { id: 'fox', name: 'Raposa', emoji: '🦊', bgColor: 'bg-orange-600' },
  { id: 'shark', name: 'Tubarao', emoji: '🦈', bgColor: 'bg-blue-700' },

  // Gaming/Tech
  { id: 'robot', name: 'Robo', emoji: '🤖', bgColor: 'bg-zinc-600' },
  { id: 'alien', name: 'Alien', emoji: '👽', bgColor: 'bg-green-600' },
  { id: 'ghost', name: 'Fantasma', emoji: '👻', bgColor: 'bg-purple-500' },
  { id: 'skull', name: 'Caveira', emoji: '💀', bgColor: 'bg-gray-800' },

  // Esporte/Forca
  { id: 'rocket', name: 'Foguete', emoji: '🚀', bgColor: 'bg-indigo-600' },
  { id: 'fire', name: 'Fogo', emoji: '🔥', bgColor: 'bg-red-500' },
  { id: 'lightning', name: 'Raio', emoji: '⚡', bgColor: 'bg-yellow-500' },
  { id: 'crown', name: 'Coroa', emoji: '👑', bgColor: 'bg-yellow-600' },

  // Natureza
  { id: 'mountain', name: 'Montanha', emoji: '🏔️', bgColor: 'bg-slate-500' },
  { id: 'sun', name: 'Sol', emoji: '☀️', bgColor: 'bg-amber-400' },
  { id: 'moon', name: 'Lua', emoji: '🌙', bgColor: 'bg-indigo-500' },
  { id: 'star', name: 'Estrela', emoji: '⭐', bgColor: 'bg-yellow-400' },

  // Trabalho/Estoque
  { id: 'package', name: 'Pacote', emoji: '📦', bgColor: 'bg-amber-600' },
  { id: 'truck', name: 'Caminhao', emoji: '🚚', bgColor: 'bg-blue-500' },
  { id: 'target', name: 'Alvo', emoji: '🎯', bgColor: 'bg-red-500' },
  { id: 'medal', name: 'Medalha', emoji: '🏅', bgColor: 'bg-yellow-500' },
];

export const DEFAULT_AVATAR = AVATARS[0]; // Lobo como padrao

export function getAvatarById(id: string | undefined): Avatar {
  if (!id) return DEFAULT_AVATAR;
  return AVATARS.find((a) => a.id === id) || DEFAULT_AVATAR;
}

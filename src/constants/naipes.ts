/**
 * Centralized naipe (voice part) constants used across the application.
 * Import from here instead of duplicating in individual components.
 */

export const naipeLabels: Record<string, string> = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baixo: 'Baixo',
};

export const naipeColors: Record<string, string> = {
  soprano: 'bg-pink-500/5 text-pink-600 dark:text-pink-400 border-pink-500/40',
  contralto: 'bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/40',
  tenor: 'bg-green-500/5 text-green-600 dark:text-green-400 border-green-500/40',
  baixo: 'bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/40',
  unissono: 'bg-slate-100 text-slate-800 border-none',
};

export const naipeGradients: Record<string, string> = {
  soprano: 'from-pink-500/10 to-pink-600/5',
  contralto: 'from-yellow-500/10 to-yellow-600/5',
  tenor: 'from-green-500/10 to-green-600/5',
  baixo: 'from-blue-500/10 to-blue-600/5',
};

export const NAIPE_ORDER = ['soprano', 'contralto', 'tenor', 'baixo', 'unissono'];

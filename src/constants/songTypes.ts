/**
 * Centralized song type constants used across the application.
 * Import from here instead of duplicating in individual components.
 */

export const typeLabels: Record<string, string> = {
  canto_entrada: 'Entrada',
  ato_penitencial: 'Ato Penitencial',
  gloria: 'Glória',
  salmo: 'Salmo',
  aclamacao: 'Aclamação',
  oferendas: 'Ofertório',
  santo: 'Santo',
  cordeiro: 'Cordeiro',
  comunhao: 'Comunhão',
  acao_gracas: 'Ação de Graças',
  final: 'Final',
  outro: 'Outro',
};

export const typeColors: Record<string, string> = {
  canto_entrada: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ato_penitencial: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  gloria: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  salmo: 'bg-green-500/10 text-green-500 border-green-500/20',
  aclamacao: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  oferendas: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  santo: 'bg-red-500/10 text-red-500 border-red-500/20',
  cordeiro: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  comunhao: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  acao_gracas: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  final: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  // Legacy types (backward compatibility)
  entrada: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  perdao: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  ofertorio: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  outro: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export const typeGradients: Record<string, string> = {
  canto_entrada: 'from-blue-500 to-blue-700',
  ato_penitencial: 'from-purple-500 to-purple-700',
  gloria: 'from-amber-500 to-amber-700',
  salmo: 'from-green-500 to-green-700',
  aclamacao: 'from-yellow-500 to-yellow-700',
  oferendas: 'from-orange-500 to-orange-700',
  santo: 'from-red-500 to-red-700',
  cordeiro: 'from-pink-500 to-pink-700',
  comunhao: 'from-indigo-500 to-indigo-700',
  acao_gracas: 'from-teal-500 to-teal-700',
  final: 'from-cyan-500 to-cyan-700',
  // Legacy types
  entrada: 'from-blue-500 to-blue-700',
  perdao: 'from-purple-500 to-purple-700',
  ofertorio: 'from-orange-500 to-orange-700',
  outro: 'from-gray-500 to-gray-700',
};

export const songTypeOrder = [
  'canto_entrada',
  'ato_penitencial',
  'gloria',
  'salmo',
  'aclamacao',
  'oferendas',
  'santo',
  'cordeiro',
  'comunhao',
  'acao_gracas',
  'final',
  'outro',
];

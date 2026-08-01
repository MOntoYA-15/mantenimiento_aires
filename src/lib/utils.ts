import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
}

export function marcaLabel(marca: string): string {
  return marca === 'le_cafe' ? 'Le Café' : 'Punta Brasas';
}

export function prioridadColor(prioridad: string): string {
  const map: Record<string, string> = {
    '1': 'bg-red-600 text-white',
    '2': 'bg-orange-500 text-white',
    '3': 'bg-yellow-400 text-black',
    '4': 'bg-blue-400 text-white',
    '5': 'bg-green-500 text-white',
  };
  return map[prioridad] || 'bg-gray-400 text-white';
}

export function estadoVisitaColor(estado: string): string {
  const map: Record<string, string> = {
    pendiente: 'bg-slate-100 text-slate-700',
    en_progreso: 'bg-blue-100 text-blue-800',
    completada: 'bg-green-100 text-green-800',
    omitida: 'bg-red-100 text-red-800',
  };
  return map[estado] || 'bg-gray-100 text-gray-700';
}

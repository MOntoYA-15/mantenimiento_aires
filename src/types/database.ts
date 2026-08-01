export type UserRole = 'admin' | 'tecnico' | 'gerente';
export type MarcaSucursal = 'le_cafe' | 'punta_brasas';
export type EstadoVisita = 'pendiente' | 'en_progreso' | 'completada' | 'omitida';
export type PrioridadEmergencia = '1' | '2' | '3' | '4' | '5';
export type EstadoProblema = 'abierto' | 'en_revision' | 'resuelto' | 'cerrado';

export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  telefono?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sucursal {
  id: string;
  nombre: string;
  marca: MarcaSucursal;
  direccion: string;
  ciudad?: string;
  estado?: string;
  codigo_postal?: string;
  latitud?: number;
  longitud?: number;
  cantidad_mini_split: number;
  cantidad_equipos_grandes: number;
  cantidad_bombas_condensacion: number;
  tiempo_estimado_minutos: number;
  orden_ciclo: number;
  activa: boolean;
  notas?: string;
  created_at: string;
  updated_at: string;
}

export interface VisitaProgramada {
  id: string;
  sucursal_id: string;
  fecha_programada: string;
  orden_del_dia: number;
  estado: EstadoVisita;
  tecnico_id?: string;
  trabajo_realizado?: string;
  observaciones?: string;
  tiempo_real_minutos?: number;
  es_emergencia: boolean;
  prioridad_emergencia?: PrioridadEmergencia;
  fecha_inicio?: string;
  fecha_fin?: string;
  created_at: string;
  updated_at: string;
  // Joins
  sucursal?: Sucursal;
  tecnico?: Perfil;
}

export interface Problema {
  id: string;
  sucursal_id: string;
  reportado_por: string;
  titulo: string;
  descripcion: string;
  prioridad: PrioridadEmergencia;
  convertido_a_emergencia: boolean;
  visita_emergencia_id?: string;
  estado: EstadoProblema;
  resuelto_por?: string;
  fecha_resolucion?: string;
  notas_resolucion?: string;
  created_at: string;
  updated_at: string;
  // Joins
  sucursal?: Sucursal;
  reportante?: Perfil;
  archivos?: ArchivoProblema[];
}

export interface ArchivoProblema {
  id: string;
  problema_id: string;
  url: string;
  tipo: 'imagen' | 'video';
  nombre_archivo?: string;
  tamanio_bytes?: number;
  created_at: string;
}

export interface CicloMantenimiento {
  id: string;
  nombre: string;
  fecha_inicio: string;
  sucursal_actual_orden: number;
  activo: boolean;
  created_at: string;
}

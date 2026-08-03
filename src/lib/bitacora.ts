import { createClient } from '@/lib/supabase/client';

export async function registrarBitacora(
  accion: string,
  entidad?: string,
  entidad_id?: string,
  detalle?: string
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let nombre = user?.email || 'Sistema';
    if (user) {
      const { data: p } = await supabase.from('perfiles').select('nombre').eq('id', user.id).single();
      if (p?.nombre) nombre = p.nombre;
    }
    await supabase.from('bitacora').insert({
      usuario_id: user?.id || null,
      usuario_nombre: nombre,
      accion,
      entidad: entidad || null,
      entidad_id: entidad_id || null,
      detalle: detalle || null,
    });
  } catch {
    // no bloquear la acción principal
  }
}

/** Minutos productivos disponibles según día de la semana */
export function minutosProductivosDelDia(fechaStr: string): number {
  const d = new Date(fechaStr + 'T12:00:00');
  const dia = d.getDay(); // 0=dom, 6=sab
  if (dia === 0) return 0; // domingo no se trabaja
  // L-V: 8-17 = 9h, menos 1h llegada y 1h almuerzo = 7h
  if (dia >= 1 && dia <= 5) return 7 * 60;
  // Sábado: 8-12 = 4h, menos 1h llegada = 3h (sin almuerzo formal)
  if (dia === 6) return 3 * 60;
  return 0;
}

export function esDiaLaborable(fechaStr: string): boolean {
  return minutosProductivosDelDia(fechaStr) > 0;
}

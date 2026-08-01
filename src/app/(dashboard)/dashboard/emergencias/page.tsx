'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { marcaLabel, prioridadColor, estadoVisitaColor } from '@/lib/utils';
import type { VisitaProgramada, Sucursal } from '@/types/database';

export default function EmergenciasPage() {
  const [emergencias, setEmergencias] = useState<(VisitaProgramada & { sucursal?: Sucursal })[]>([]);
  const [loading, setLoading] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: { user } }] = await Promise.all([
      supabase
        .from('visitas_programadas')
        .select('*, sucursal:sucursales(*)')
        .eq('es_emergencia', true)
        .order('prioridad_emergencia')
        .order('fecha_programada', { ascending: false }),
      supabase.auth.getUser(),
    ]);
    setEmergencias(data || []);
    if (user) {
      const { data: p } = await supabase.from('perfiles').select('rol').eq('id', user.id).single();
      setEsAdmin(p?.rol === 'admin');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta emergencia de la lista?')) return;
    await supabase.from('visitas_programadas').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Emergencias</h1>
        <p className="text-slate-500 mt-1 text-sm">Visitas de emergencia por prioridad (1 = más urgente)</p>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : emergencias.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-12 text-center text-slate-400">
          No hay emergencias registradas
        </div>
      ) : (
        <div className="space-y-3">
          {emergencias.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${prioridadColor(e.prioridad_emergencia || '3')}`}>
                {e.prioridad_emergencia}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800">{e.sucursal?.nombre}</h3>
                <p className="text-sm text-slate-500 break-words">
                  {e.sucursal && marcaLabel(e.sucursal.marca)} · {e.fecha_programada}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${estadoVisitaColor(e.estado)}`}>
                  {e.estado.replace('_', ' ')}
                </span>
                {esAdmin && (
                  <button onClick={() => eliminar(e.id)}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

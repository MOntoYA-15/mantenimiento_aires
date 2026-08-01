'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { marcaLabel, prioridadColor, estadoVisitaColor } from '@/lib/utils';
import type { VisitaProgramada, Sucursal } from '@/types/database';

export default function EmergenciasPage() {
  const [emergencias, setEmergencias] = useState<(VisitaProgramada & { sucursal?: Sucursal })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('visitas_programadas')
        .select('*, sucursal:sucursales(*)')
        .eq('es_emergencia', true)
        .order('prioridad_emergencia')
        .order('fecha_programada', { ascending: false });
      setEmergencias(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Emergencias</h1>
        <p className="text-slate-500 mt-1">Visitas de emergencia por prioridad (1 = más urgente)</p>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : emergencias.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
          No hay emergencias registradas
        </div>
      ) : (
        <div className="space-y-3">
          {emergencias.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${prioridadColor(e.prioridad_emergencia || '3')}`}>
                {e.prioridad_emergencia}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800">{e.sucursal?.nombre}</h3>
                <p className="text-sm text-slate-500">
                  {e.sucursal && marcaLabel(e.sucursal.marca)} · {e.fecha_programada}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${estadoVisitaColor(e.estado)}`}>
                {e.estado.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMinutos, marcaLabel, estadoVisitaColor } from '@/lib/utils';
import type { VisitaProgramada, Sucursal } from '@/types/database';

export default function HistorialPage() {
  const [visitas, setVisitas] = useState<(VisitaProgramada & { sucursal?: Sucursal })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('visitas_programadas')
        .select('*, sucursal:sucursales(*)')
        .eq('estado', 'completada')
        .order('fecha_programada', { ascending: false })
        .limit(50);
      setVisitas(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Historial de mantenimientos</h1>
        <p className="text-slate-500 mt-1">Visitas completadas recientemente</p>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : visitas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
          Aún no hay visitas completadas
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Tiempo</th>
                <th className="px-4 py-3 font-medium">Trabajo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visitas.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">{v.fecha_programada}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{v.sucursal?.nombre}</div>
                    <div className="text-xs text-slate-400">{v.sucursal && marcaLabel(v.sucursal.marca)}</div>
                  </td>
                  <td className="px-4 py-3">
                    {v.es_emergencia ? (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        Emergencia P{v.prioridad_emergencia}
                      </span>
                    ) : (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Preventivo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {formatMinutos(v.tiempo_real_minutos || 0)}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-600">
                    {v.trabajo_realizado || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

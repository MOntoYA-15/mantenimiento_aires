'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { marcaLabel, prioridadColor, estadoVisitaColor, formatHoras } from '@/lib/utils';
import { registrarBitacora } from '@/lib/bitacora';
import type { VisitaProgramada, Sucursal } from '@/types/database';
import Link from 'next/link';

export default function EmergenciasPage() {
  const [emergencias, setEmergencias] = useState<(VisitaProgramada & { sucursal?: Sucursal })[]>([]);
  const [loading, setLoading] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [puedeCerrar, setPuedeCerrar] = useState(false);
  const [cerrando, setCerrando] = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: { user } }] = await Promise.all([
      supabase
        .from('visitas_programadas')
        .select('*, sucursal:sucursales(*)')
        .eq('es_emergencia', true)
        .neq('estado', 'completada')
        .neq('estado', 'omitida')
        .order('prioridad_emergencia')
        .order('fecha_programada', { ascending: false }),
      supabase.auth.getUser(),
    ]);
    // Filtro extra por si el servidor no aplica bien
    const activas = (data || []).filter(
      (e) => e.estado === 'pendiente' || e.estado === 'en_progreso' || e.estado === 'parcial'
    );
    setEmergencias(activas);
    if (user) {
      const { data: p } = await supabase.from('perfiles').select('rol').eq('id', user.id).single();
      setEsAdmin(p?.rol === 'admin');
      setPuedeCerrar(p?.rol === 'admin' || p?.rol === 'tecnico');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const completar = async (e: VisitaProgramada & { sucursal?: Sucursal }) => {
    if (!confirm(`¿Marcar emergencia de "${e.sucursal?.nombre}" como completada? Pasará al historial.`)) return;
    setCerrando(e.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('visitas_programadas')
      .update({
        estado: 'completada',
        fecha_fin: new Date().toISOString(),
        tecnico_id: user?.id,
        trabajo_realizado: e.trabajo_realizado || 'Emergencia atendida',
      })
      .eq('id', e.id);

    if (error) {
      alert('Error: ' + error.message);
      setCerrando(null);
      return;
    }

    // Cerrar problemas abiertos de esa sucursal
    if (e.sucursal_id) {
      await supabase
        .from('problemas')
        .update({
          estado: 'resuelto',
          fecha_resolucion: new Date().toISOString(),
          resuelto_por: user?.id,
          notas_resolucion: 'Resuelto al completar emergencia',
        })
        .eq('sucursal_id', e.sucursal_id)
        .eq('estado', 'abierto');
    }

    await registrarBitacora('completar_emergencia', 'visitas_programadas', e.id, e.sucursal?.nombre);
    setCerrando(null);
    load();
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta emergencia?')) return;
    await supabase.from('visitas_programadas').delete().eq('id', id);
    await registrarBitacora('eliminar_emergencia', 'visitas_programadas', id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Emergencias activas</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Solo pendientes. Al completar pasan al{' '}
            <Link href="/dashboard/historial" className="text-sky-600 hover:underline">historial</Link>
          </p>
        </div>
        <button onClick={load} className="text-sm px-3 py-2 rounded-xl bg-slate-100 text-slate-700 self-start">
          Actualizar
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : emergencias.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-12 text-center text-slate-400">
          No hay emergencias pendientes
        </div>
      ) : (
        <div className="space-y-3">
          {emergencias.map((e) => (
            <div
              key={e.id}
              className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${prioridadColor(e.prioridad_emergencia || '3')}`}>
                  {e.prioridad_emergencia}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800">{e.sucursal?.nombre}</h3>
                  <p className="text-sm text-slate-500 break-words">
                    {e.sucursal && marcaLabel(e.sucursal.marca)} · {e.fecha_programada}
                    {e.sucursal && ` · Est. ${formatHoras(e.sucursal.tiempo_estimado_minutos)}`}
                  </p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${estadoVisitaColor(e.estado)}`}>
                    {e.estado.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {puedeCerrar && (
                  <button
                    onClick={() => completar(e)}
                    disabled={cerrando === e.id}
                    className="text-sm px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    {cerrando === e.id ? 'Guardando...' : 'Marcar completada'}
                  </button>
                )}
                <Link
                  href="/dashboard/ruta"
                  className="text-sm px-3 py-1.5 bg-sky-50 text-sky-700 rounded-lg hover:bg-sky-100"
                >
                  Ver en ruta
                </Link>
                {esAdmin && (
                  <button
                    onClick={() => eliminar(e.id)}
                    className="text-sm px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                  >
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

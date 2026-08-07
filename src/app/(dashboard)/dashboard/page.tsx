'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatHoras, marcaLabel, estadoVisitaColor } from '@/lib/utils';
import type { Sucursal, VisitaProgramada, Problema } from '@/types/database';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    sucursales: 0,
    visitasPendientes: 0,
    visitasCompletadasHoy: 0,
    problemasAbiertos: 0,
    emergencias: 0,
  });
  const [visitasHoy, setVisitasHoy] = useState<(VisitaProgramada & { sucursal?: Sucursal })[]>([]);
  const [problemas, setProblemas] = useState<(Problema & { sucursal?: Sucursal })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    const hoy = new Date().toISOString().split('T')[0];

    const [
      { count: sucCount },
      { data: visitas },
      { count: probCount },
      { data: probs },
      { count: emergCount },
      { count: completadasHoy },
    ] = await Promise.all([
      supabase.from('sucursales').select('*', { count: 'exact', head: true }).eq('activa', true),
      supabase
        .from('visitas_programadas')
        .select('*, sucursal:sucursales(*)')
        .eq('fecha_programada', hoy)
        .in('estado', ['pendiente', 'en_progreso', 'parcial'])
        .order('orden_del_dia'),
      supabase.from('problemas').select('*', { count: 'exact', head: true }).eq('estado', 'abierto'),
      supabase
        .from('problemas')
        .select('*, sucursal:sucursales(*)')
        .eq('estado', 'abierto')
        .order('prioridad')
        .limit(5),
      supabase
        .from('visitas_programadas')
        .select('*', { count: 'exact', head: true })
        .eq('es_emergencia', true)
        .in('estado', ['pendiente', 'en_progreso', 'parcial']),
      supabase
        .from('visitas_programadas')
        .select('*', { count: 'exact', head: true })
        .eq('fecha_programada', hoy)
        .eq('estado', 'completada'),
    ]);

    setStats({
      sucursales: sucCount || 0,
      visitasPendientes: visitas?.length || 0,
      visitasCompletadasHoy: completadasHoy || 0,
      problemasAbiertos: probCount || 0,
      emergencias: emergCount || 0,
    });
    setVisitasHoy(visitas || []);
    setProblemas(probs || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(load, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [load]);

  const cards = [
    { label: 'Sucursales activas', value: stats.sucursales, color: 'bg-sky-500', icon: '📍', href: '/dashboard/sucursales' },
    { label: 'Pendientes hoy', value: stats.visitasPendientes, color: 'bg-emerald-500', icon: '🗓️', href: '/dashboard/ruta' },
    { label: 'Completadas hoy', value: stats.visitasCompletadasHoy, color: 'bg-green-600', icon: '✅', href: '/dashboard/historial' },
    { label: 'Problemas abiertos', value: stats.problemasAbiertos, color: 'bg-amber-500', icon: '⚠️', href: '/dashboard/problemas' },
    { label: 'Emergencias activas', value: stats.emergencias, color: 'bg-red-500', icon: '🚨', href: '/dashboard/emergencias' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Panel principal</h1>
          <p className="text-slate-500 mt-1 text-sm">Resumen en vivo · se actualiza solo</p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="text-sm px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 self-start"
        >
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm hover:border-sky-200 transition"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-500 truncate">{c.label}</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">
                  {loading ? '—' : c.value}
                </p>
              </div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${c.color} text-white flex items-center justify-center text-lg shrink-0`}>
                {c.icon}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Pendientes de hoy</h2>
            <Link href="/dashboard/ruta" className="text-sm text-sky-600 hover:underline">
              Ir a ruta
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {visitasHoy.length === 0 ? (
              <p className="p-5 text-slate-400 text-sm">
                No hay visitas pendientes. Las completadas están en el historial.
              </p>
            ) : (
              visitasHoy.map((v) => (
                <div key={v.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600 shrink-0">
                    {v.orden_del_dia}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">
                      {v.sucursal?.nombre || 'Sucursal'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {v.sucursal && marcaLabel(v.sucursal.marca)} · {formatHoras(v.sucursal?.tiempo_estimado_minutos || 0)}
                      {v.es_emergencia && (
                        <span className="ml-2 text-red-500 font-medium">Emergencia P{v.prioridad_emergencia}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${estadoVisitaColor(v.estado)}`}>
                    {v.estado.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Problemas abiertos</h2>
            <Link href="/dashboard/problemas" className="text-sm text-sky-600 hover:underline">
              Ver todo
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {problemas.length === 0 ? (
              <p className="p-5 text-slate-400 text-sm">No hay problemas abiertos</p>
            ) : (
              problemas.map((p) => (
                <div key={p.id} className="px-4 sm:px-5 py-3">
                  <div className="flex items-start gap-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      p.prioridad === '1' || p.prioridad === '2' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      P{p.prioridad}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 truncate">{p.titulo}</div>
                      <div className="text-xs text-slate-400">
                        {p.sucursal?.nombre} · {p.sucursal && marcaLabel(p.sucursal.marca)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

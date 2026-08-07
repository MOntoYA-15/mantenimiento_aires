'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { marcaLabel, estadoVisitaColor } from '@/lib/utils';
import type { Sucursal, Problema } from '@/types/database';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    sucursales: 0,
    completadasHoy: 0,
    problemasAbiertos: 0,
    emergencias: 0,
  });
  const [siguiente, setSiguiente] = useState<Sucursal | null>(null);
  const [problemas, setProblemas] = useState<(Problema & { sucursal?: Sucursal })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const hoy = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    const [
      { count: sucCount },
      { data: sucs },
      { data: visitasHoy },
      { count: probCount },
      { data: probs },
      { count: emergCount },
      { count: completadasHoy },
    ] = await Promise.all([
      supabase.from('sucursales').select('*', { count: 'exact', head: true }).eq('activa', true),
      supabase.from('sucursales').select('*').eq('activa', true).order('orden_ciclo').limit(15),
      supabase.from('visitas_programadas').select('sucursal_id, estado').eq('fecha_programada', hoy),
      supabase.from('problemas').select('*', { count: 'exact', head: true }).eq('estado', 'abierto'),
      supabase.from('problemas').select('*, sucursal:sucursales(*)').eq('estado', 'abierto').order('prioridad').limit(5),
      supabase.from('visitas_programadas').select('*', { count: 'exact', head: true }).eq('es_emergencia', true).in('estado', ['pendiente', 'en_progreso', 'parcial']),
      supabase.from('visitas_programadas').select('*', { count: 'exact', head: true }).eq('fecha_programada', hoy).eq('estado', 'completada'),
    ]);

    const done = new Set((visitasHoy || []).filter((v) => v.estado === 'completada').map((v) => v.sucursal_id));
    const next = (sucs || []).find((s) => !done.has(s.id)) || null;

    setStats({
      sucursales: sucCount || 0,
      completadasHoy: completadasHoy || 0,
      problemasAbiertos: probCount || 0,
      emergencias: emergCount || 0,
    });
    setSiguiente(next);
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
    { label: 'Sucursales', value: stats.sucursales, gradient: 'from-sky-500 to-cyan-500', href: '/dashboard/sucursales' },
    { label: 'Hechas hoy', value: stats.completadasHoy, gradient: 'from-emerald-500 to-green-600', href: '/dashboard/historial' },
    { label: 'Problemas', value: stats.problemasAbiertos, gradient: 'from-amber-400 to-orange-500', href: '/dashboard/problemas' },
    { label: 'Emergencias', value: stats.emergencias, gradient: 'from-rose-500 to-red-600', href: '/dashboard/emergencias' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Panel principal</h1>
          <p className="text-slate-500 mt-1 text-sm">Resumen en vivo del mantenimiento</p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="text-sm px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm self-start"
        >
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}
            className={`stat-card rounded-2xl p-4 sm:p-5 text-white bg-gradient-to-br ${c.gradient} shadow-lg hover:scale-[1.02] transition-transform`}>
            <p className="text-xs sm:text-sm text-white/80 font-medium">{c.label}</p>
            <p className="text-3xl sm:text-4xl font-bold mt-1 tabular-nums">{loading ? '—' : c.value}</p>
          </Link>
        ))}
      </div>

      {siguiente && (
        <Link href="/dashboard/ruta"
          className="block card-elevated p-5 sm:p-6 border-l-4 border-l-sky-500 hover:border-l-sky-600 transition">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 mb-1">Siguiente en la ruta</p>
              <h2 className="text-xl font-bold text-slate-800">{siguiente.nombre}</h2>
              <p className="text-sm text-slate-500 mt-1">{siguiente.direccion}</p>
              <p className="text-xs text-slate-400 mt-2">
                {siguiente.cantidad_mini_split} Mini · {siguiente.cantidad_equipos_grandes} grandes · {siguiente.cantidad_bombas_condensacion} bombas
                {' · '}{marcaLabel(siguiente.marca)}
              </p>
            </div>
            <span className="btn-primary px-5 py-2.5 text-sm inline-flex self-start sm:self-center">
              Ir a la ruta →
            </span>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-elevated overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-semibold text-slate-800">Problemas abiertos</h2>
            <Link href="/dashboard/problemas" className="text-sm text-sky-600 font-medium hover:underline">Ver todo</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {problemas.length === 0 ? (
              <p className="p-6 text-slate-400 text-sm text-center">Sin problemas abiertos</p>
            ) : (
              problemas.map((p) => (
                <div key={p.id} className="px-5 py-3.5 flex gap-3 items-start">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${
                    p.prioridad === '1' || p.prioridad === '2' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                  }`}>P{p.prioridad}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{p.titulo}</div>
                    <div className="text-xs text-slate-400">{p.sucursal?.nombre}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-elevated p-5 sm:p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Accesos rápidos</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/dashboard/ruta', label: 'Ruta del día', desc: 'Atender siguiente' },
              { href: '/dashboard/problemas', label: 'Reportar', desc: 'Nuevo problema' },
              { href: '/dashboard/historial', label: 'Historial', desc: 'Trabajos hechos' },
              { href: '/dashboard/sucursales', label: 'Sucursales', desc: 'Equipos y orden' },
            ].map((a) => (
              <Link key={a.href} href={a.href}
                className="rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-sky-50 hover:border-sky-200 p-4 transition group">
                <div className="font-semibold text-slate-800 group-hover:text-sky-700 text-sm">{a.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{a.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

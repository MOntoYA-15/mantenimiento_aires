'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMinutos, marcaLabel, estadoVisitaColor } from '@/lib/utils';
import type { Sucursal, VisitaProgramada, Problema } from '@/types/database';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    sucursales: 0,
    visitasHoy: 0,
    problemasAbiertos: 0,
    emergencias: 0,
  });
  const [visitasHoy, setVisitasHoy] = useState<(VisitaProgramada & { sucursal?: Sucursal })[]>([]);
  const [problemas, setProblemas] = useState<(Problema & { sucursal?: Sucursal })[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const hoy = new Date().toISOString().split('T')[0];

      const [
        { count: sucCount },
        { data: visitas },
        { count: probCount },
        { data: probs },
      ] = await Promise.all([
        supabase.from('sucursales').select('*', { count: 'exact', head: true }).eq('activa', true),
        supabase
          .from('visitas_programadas')
          .select('*, sucursal:sucursales(*)')
          .eq('fecha_programada', hoy)
          .order('orden_del_dia'),
        supabase.from('problemas').select('*', { count: 'exact', head: true }).eq('estado', 'abierto'),
        supabase
          .from('problemas')
          .select('*, sucursal:sucursales(*)')
          .eq('estado', 'abierto')
          .order('prioridad')
          .limit(5),
      ]);

      const emergencias = (visitas || []).filter((v) => v.es_emergencia).length;

      setStats({
        sucursales: sucCount || 0,
        visitasHoy: visitas?.length || 0,
        problemasAbiertos: probCount || 0,
        emergencias,
      });
      setVisitasHoy(visitas || []);
      setProblemas(probs || []);
    }
    load();
  }, []);

  const cards = [
    { label: 'Sucursales activas', value: stats.sucursales, color: 'bg-sky-500', icon: '📍' },
    { label: 'Visitas de hoy', value: stats.visitasHoy, color: 'bg-emerald-500', icon: '🗓️' },
    { label: 'Problemas abiertos', value: stats.problemasAbiertos, color: 'bg-amber-500', icon: '⚠️' },
    { label: 'Emergencias hoy', value: stats.emergencias, color: 'bg-red-500', icon: '🚨' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Panel principal</h1>
        <p className="text-slate-500 mt-1">Resumen del mantenimiento de aires acondicionados</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{c.label}</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{c.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${c.color} text-white flex items-center justify-center text-xl`}>
                {c.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ruta de hoy */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Ruta de hoy</h2>
            <Link href="/dashboard/ruta" className="text-sm text-sky-600 hover:underline">
              Ver todo
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {visitasHoy.length === 0 ? (
              <p className="p-5 text-slate-400 text-sm">No hay visitas programadas para hoy</p>
            ) : (
              visitasHoy.map((v) => (
                <div key={v.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                    {v.orden_del_dia}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">
                      {v.sucursal?.nombre || 'Sucursal'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {v.sucursal && marcaLabel(v.sucursal.marca)} · {formatMinutos(v.sucursal?.tiempo_estimado_minutos || 0)}
                      {v.es_emergencia && (
                        <span className="ml-2 text-red-500 font-medium">Emergencia {v.prioridad_emergencia}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${estadoVisitaColor(v.estado)}`}>
                    {v.estado.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Problemas recientes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
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
                <div key={p.id} className="px-5 py-3">
                  <div className="flex items-start gap-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
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

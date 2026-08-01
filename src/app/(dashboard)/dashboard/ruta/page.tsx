'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMinutos, marcaLabel, estadoVisitaColor } from '@/lib/utils';
import type { VisitaProgramada, Sucursal } from '@/types/database';

export default function RutaPage() {
  const [visitas, setVisitas] = useState<(VisitaProgramada & { sucursal?: Sucursal })[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<(VisitaProgramada & { sucursal?: Sucursal }) | null>(null);
  const [trabajo, setTrabajo] = useState('');
  const [obs, setObs] = useState('');
  const [tiempoReal, setTiempoReal] = useState(0);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('visitas_programadas')
      .select('*, sucursal:sucursales(*)')
      .eq('fecha_programada', fecha)
      .order('orden_del_dia');
    setVisitas(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [fecha]);

  const generarRutaDia = async () => {
    // Genera la ruta del día basada en el ciclo + emergencias
    const { data: sucursales } = await supabase
      .from('sucursales')
      .select('*')
      .eq('activa', true)
      .order('orden_ciclo');

    if (!sucursales || sucursales.length === 0) {
      alert('No hay sucursales activas');
      return;
    }

    // Verificar si ya hay visitas para ese día
    const { data: existentes } = await supabase
      .from('visitas_programadas')
      .select('id')
      .eq('fecha_programada', fecha);

    if (existentes && existentes.length > 0) {
      if (!confirm('Ya hay visitas para este día. ¿Deseas regenerarlas?')) return;
      await supabase.from('visitas_programadas').delete().eq('fecha_programada', fecha);
    }

    // Obtener ciclo actual
    const { data: ciclo } = await supabase
      .from('ciclo_mantenimiento')
      .select('*')
      .eq('activo', true)
      .single();

    let ordenActual = ciclo?.sucursal_actual_orden || 0;
    const visitasNuevas = [];
    // Por defecto 3-4 sucursales por día (ajustable)
    const porDia = 3;

    for (let i = 0; i < porDia; i++) {
      const idx = (ordenActual + i) % sucursales.length;
      visitasNuevas.push({
        sucursal_id: sucursales[idx].id,
        fecha_programada: fecha,
        orden_del_dia: i + 1,
        estado: 'pendiente',
        es_emergencia: false,
      });
    }

    await supabase.from('visitas_programadas').insert(visitasNuevas);

    // Actualizar ciclo
    if (ciclo) {
      await supabase
        .from('ciclo_mantenimiento')
        .update({ sucursal_actual_orden: (ordenActual + porDia) % sucursales.length })
        .eq('id', ciclo.id);
    }

    load();
  };

  const completarVisita = async () => {
    if (!selected) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from('visitas_programadas')
      .update({
        estado: 'completada',
        tecnico_id: user?.id,
        trabajo_realizado: trabajo,
        observaciones: obs,
        tiempo_real_minutos: tiempoReal || selected.sucursal?.tiempo_estimado_minutos,
        fecha_fin: new Date().toISOString(),
      })
      .eq('id', selected.id);

    setSaving(false);
    setSelected(null);
    setTrabajo('');
    setObs('');
    setTiempoReal(0);
    load();
  };

  const iniciarVisita = async (id: string) => {
    await supabase
      .from('visitas_programadas')
      .update({ estado: 'en_progreso', fecha_inicio: new Date().toISOString() })
      .eq('id', id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ruta del día</h1>
          <p className="text-slate-500 mt-1">Sucursales programadas y ciclo de mantenimiento</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-sky-400"
          />
          <button
            onClick={generarRutaDia}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium text-sm"
          >
            Generar ruta
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : visitas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-slate-400 mb-4">No hay visitas para esta fecha</p>
          <button
            onClick={generarRutaDia}
            className="px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-medium"
          >
            Generar ruta automática
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visitas.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-600 shrink-0">
                {v.orden_del_dia}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-800">{v.sucursal?.nombre}</h3>
                  {v.es_emergencia && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      Emergencia P{v.prioridad_emergencia}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${estadoVisitaColor(v.estado)}`}>
                    {v.estado.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {v.sucursal && marcaLabel(v.sucursal.marca)} · {v.sucursal?.direccion}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {v.sucursal?.cantidad_mini_split} Mini Split · {v.sucursal?.cantidad_equipos_grandes} grandes ·{' '}
                  {v.sucursal?.cantidad_bombas_condensacion} bombas · Est. {formatMinutos(v.sucursal?.tiempo_estimado_minutos || 0)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {v.estado === 'pendiente' && (
                  <button
                    onClick={() => iniciarVisita(v.id)}
                    className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                  >
                    Iniciar
                  </button>
                )}
                {(v.estado === 'pendiente' || v.estado === 'en_progreso') && (
                  <button
                    onClick={() => {
                      setSelected(v);
                      setTiempoReal(v.sucursal?.tiempo_estimado_minutos || 60);
                    }}
                    className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                  >
                    Completar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal completar */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-lg">Completar visita</h3>
              <p className="text-sm text-slate-500">{selected.sucursal?.nombre}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trabajo realizado</label>
                <textarea
                  value={trabajo}
                  onChange={(e) => setTrabajo(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-sky-400 resize-none"
                  placeholder="Limpieza de filtros, revisión de gas, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-sky-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo real (minutos)</label>
                <input
                  type="number"
                  value={tiempoReal}
                  onChange={(e) => setTiempoReal(+e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-sky-400"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelected(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={completarVisita}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Marcar completada'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

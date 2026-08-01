'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatHoras, marcaLabel, estadoVisitaColor } from '@/lib/utils';
import type { VisitaProgramada, Sucursal, Perfil } from '@/types/database';

export default function RutaPage() {
  const [visitas, setVisitas] = useState<(VisitaProgramada & { sucursal?: Sucursal })[]>([]);
  const [todasSucursales, setTodasSucursales] = useState<Sucursal[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [selected, setSelected] = useState<(VisitaProgramada & { sucursal?: Sucursal }) | null>(null);
  const [modoCierre, setModoCierre] = useState<'completa' | 'parcial'>('completa');
  const [trabajo, setTrabajo] = useState('');
  const [obs, setObs] = useState('');
  const [tiempoRealHoras, setTiempoRealHoras] = useState(1);
  const [airesPendientes, setAiresPendientes] = useState(0);
  const [miniPend, setMiniPend] = useState(0);
  const [grandesPend, setGrandesPend] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showAddSucursal, setShowAddSucursal] = useState(false);
  const [sucursalAddId, setSucursalAddId] = useState('');
  const supabase = createClient();

  const esAdmin = perfil?.rol === 'admin';
  const puedeCerrar = perfil?.rol === 'admin' || perfil?.rol === 'tecnico';

  const [evidencias, setEvidencias] = useState<File[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: sucs }, { data: { user } }] = await Promise.all([
      supabase
        .from('visitas_programadas')
        .select('*, sucursal:sucursales(*)')
        .eq('fecha_programada', fecha)
        .in('estado', ['pendiente', 'en_progreso', 'parcial'])
        .order('orden_del_dia'),
      supabase.from('sucursales').select('*').eq('activa', true).order('orden_ciclo'),
      supabase.auth.getUser(),
    ]);
    setVisitas(data || []);
    setTodasSucursales(sucs || []);
    if (user) {
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
      setPerfil(p);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [fecha]);

  const generarRutaDia = async () => {
    const { data: sucursales } = await supabase
      .from('sucursales')
      .select('*')
      .eq('activa', true)
      .order('orden_ciclo');

    if (!sucursales || sucursales.length === 0) {
      alert('No hay sucursales activas. Agrega sucursales primero.');
      return;
    }

    const { data: existentes } = await supabase
      .from('visitas_programadas')
      .select('id')
      .eq('fecha_programada', fecha);

    if (existentes && existentes.length > 0) {
      if (!confirm('Ya hay visitas para este día. ¿Deseas regenerarlas? Se borrarán las actuales.')) return;
      await supabase.from('visitas_programadas').delete().eq('fecha_programada', fecha);
    }

    // Asegurar que exista un ciclo
    let { data: ciclo } = await supabase
      .from('ciclo_mantenimiento')
      .select('*')
      .eq('activo', true)
      .maybeSingle();

    if (!ciclo) {
      const { data: nuevo } = await supabase
        .from('ciclo_mantenimiento')
        .insert({ nombre: 'Ciclo Principal', fecha_inicio: fecha, sucursal_actual_orden: 0, activo: true })
        .select()
        .single();
      ciclo = nuevo;
    }

    let ordenActual = ciclo?.sucursal_actual_orden || 0;
    // Si el orden está fuera de rango (sucursales nuevas), reiniciar
    if (ordenActual >= sucursales.length) ordenActual = 0;

    const porDia = Math.min(3, sucursales.length);
    const visitasNuevas = [];

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

    const { error } = await supabase.from('visitas_programadas').insert(visitasNuevas);
    if (error) {
      alert('Error al generar ruta: ' + error.message);
      return;
    }

    if (ciclo) {
      await supabase
        .from('ciclo_mantenimiento')
        .update({ sucursal_actual_orden: (ordenActual + porDia) % sucursales.length })
        .eq('id', ciclo.id);
    }

    load();
  };

  const iniciarVisita = async (id: string) => {
    await supabase
      .from('visitas_programadas')
      .update({ estado: 'en_progreso', fecha_inicio: new Date().toISOString() })
      .eq('id', id);
    load();
  };

  const abrirCierre = (v: VisitaProgramada & { sucursal?: Sucursal }, modo: 'completa' | 'parcial') => {
    setSelected(v);
    setModoCierre(modo);
    setTrabajo('');
    setObs('');
    setTiempoRealHoras((v.sucursal?.tiempo_estimado_minutos || 60) / 60);
    setAiresPendientes(0);
    setMiniPend(0);
    setGrandesPend(0);
    setEvidencias([]);
  };

  const guardarCierre = async () => {
    if (!selected) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const update: Record<string, unknown> = {
      tecnico_id: user?.id,
      trabajo_realizado: trabajo,
      observaciones: obs,
      tiempo_real_minutos: Math.round(tiempoRealHoras * 60),
      fecha_fin: new Date().toISOString(),
    };

    if (modoCierre === 'completa') {
      update.estado = 'completada';
      update.aires_pendientes = 0;
      update.mini_split_pendientes = 0;
      update.equipos_grandes_pendientes = 0;
    } else {
      update.estado = 'parcial';
      update.aires_pendientes = airesPendientes;
      update.mini_split_pendientes = miniPend;
      update.equipos_grandes_pendientes = grandesPend;
    }

    const { error } = await supabase
      .from('visitas_programadas')
      .update(update)
      .eq('id', selected.id);

    if (error) {
      alert('Error: ' + error.message);
      setSaving(false);
      return;
    }

    // Subir evidencias fotográficas
    for (const file of evidencias) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `visitas/${selected.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('archivos').upload(path, file);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path);
        await supabase.from('archivos_visita').insert({
          visita_id: selected.id,
          url: urlData.publicUrl,
          tipo: file.type.startsWith('video') ? 'video' : 'imagen',
          nombre_archivo: file.name,
        });
      }
    }

    setSaving(false);
    setSelected(null);
    setEvidencias([]);
    load();
  };

  const eliminarVisita = async (id: string) => {
    if (!confirm('¿Quitar esta sucursal de la ruta de hoy?')) return;
    await supabase.from('visitas_programadas').delete().eq('id', id);
    load();
  };

  const agregarARuta = async () => {
    if (!sucursalAddId) return;
    const maxOrden = visitas.length > 0 ? Math.max(...visitas.map((v) => v.orden_del_dia)) : 0;
    await supabase.from('visitas_programadas').insert({
      sucursal_id: sucursalAddId,
      fecha_programada: fecha,
      orden_del_dia: maxOrden + 1,
      estado: 'pendiente',
      es_emergencia: false,
    });
    setShowAddSucursal(false);
    setSucursalAddId('');
    load();
  };

  const idsEnRuta = new Set(visitas.map((v) => v.sucursal_id));
  const sucursalesDisponibles = todasSucursales.filter((s) => !idsEnRuta.has(s.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Ruta del día</h1>
          <p className="text-slate-500 mt-1 text-sm">Sucursales programadas y ciclo de mantenimiento</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-sky-400 text-sm" />
          <button onClick={generarRutaDia}
            className="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium text-sm">
            Generar ruta
          </button>
          {esAdmin && (
            <button onClick={() => setShowAddSucursal(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm">
              + Agregar a ruta
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : visitas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-12 text-center">
          <p className="text-slate-400 mb-4">No hay visitas para esta fecha</p>
          <button onClick={generarRutaDia}
            className="px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-medium">
            Generar ruta automática
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visitas.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-600 shrink-0">
                  {v.orden_del_dia}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-800">{v.sucursal?.nombre || 'Sucursal'}</h3>
                    {v.es_emergencia && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        Emergencia P{v.prioridad_emergencia}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${estadoVisitaColor(v.estado)}`}>
                      {v.estado === 'parcial' ? 'parcial' : v.estado.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5 break-words">
                    {v.sucursal && marcaLabel(v.sucursal.marca)} · {v.sucursal?.direccion}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {v.sucursal?.cantidad_mini_split} Mini Split · {v.sucursal?.cantidad_equipos_grandes} grandes ·{' '}
                    Est. {formatHoras(v.sucursal?.tiempo_estimado_minutos || 0)}
                  </p>
                  {v.estado === 'parcial' && (
                    <p className="text-xs text-amber-600 mt-1">
                      Pendientes: {v.aires_pendientes || 0} aires
                      {(v.mini_split_pendientes || 0) > 0 && ` (${v.mini_split_pendientes} mini)`}
                      {(v.equipos_grandes_pendientes || 0) > 0 && ` (${v.equipos_grandes_pendientes} grandes)`}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {puedeCerrar && v.estado === 'pendiente' && (
                    <button onClick={() => iniciarVisita(v.id)}
                      className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                      Iniciar
                    </button>
                  )}
                  {puedeCerrar && (v.estado === 'pendiente' || v.estado === 'en_progreso') && (
                    <>
                      <button onClick={() => abrirCierre(v, 'completa')}
                        className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100">
                        Terminado
                      </button>
                      <button onClick={() => abrirCierre(v, 'parcial')}
                        className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100">
                        Parcial
                      </button>
                    </>
                  )}
                  {esAdmin && (v.estado === 'pendiente' || v.estado === 'en_progreso') && (
                    <button onClick={() => eliminarVisita(v.id)}
                      className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal cierre */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-lg">
                {modoCierre === 'completa' ? 'Marcar terminada' : 'Cierre parcial'}
              </h3>
              <p className="text-sm text-slate-500">{selected.sucursal?.nombre}</p>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trabajo realizado</label>
                <textarea value={trabajo} onChange={(e) => setTrabajo(e.target.value)} rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none resize-none text-base"
                  placeholder="Limpieza de filtros, revisión de gas, etc." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
                <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none resize-none text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo real (horas)</label>
                <input type="number" min={0.25} step={0.25} value={tiempoRealHoras}
                  onChange={(e) => setTiempoRealHoras(+e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-base" />
              </div>
              {modoCierre === 'parcial' && (
                <div className="space-y-3 p-3 bg-amber-50 rounded-xl">
                  <p className="text-sm font-medium text-amber-800">Aires que faltan por hacer</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-slate-600">Total pendientes</label>
                      <input type="number" min={0} value={airesPendientes}
                        onChange={(e) => setAiresPendientes(+e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-base" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Mini Split</label>
                      <input type="number" min={0} value={miniPend}
                        onChange={(e) => setMiniPend(+e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-base" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Grandes</label>
                      <input type="number" min={0} value={grandesPend}
                        onChange={(e) => setGrandesPend(+e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-base" />
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Evidencias fotográficas (opcional)
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => setEvidencias(e.target.files ? Array.from(e.target.files) : [])}
                  className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-sky-50 file:text-sky-700 file:font-medium"
                />
                {evidencias.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1">{evidencias.length} archivo(s) seleccionado(s)</p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSelected(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600">Cancelar</button>
                <button onClick={guardarCierre} disabled={saving}
                  className={`flex-1 py-3 rounded-xl text-white font-medium disabled:opacity-60 ${
                    modoCierre === 'completa' ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600'
                  }`}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar a ruta (admin) */}
      {showAddSucursal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-4 sm:p-6">
            <h3 className="font-semibold text-lg mb-4">Agregar sucursal a la ruta</h3>
            {sucursalesDisponibles.length === 0 ? (
              <p className="text-slate-400 text-sm mb-4">Todas las sucursales activas ya están en la ruta de hoy.</p>
            ) : (
              <select value={sucursalAddId} onChange={(e) => setSucursalAddId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 mb-4 text-base">
                <option value="">Seleccionar...</option>
                {sucursalesDisponibles.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre} ({marcaLabel(s.marca)})</option>
                ))}
              </select>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowAddSucursal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200">Cancelar</button>
              <button onClick={agregarARuta} disabled={!sucursalAddId}
                className="flex-1 py-3 rounded-xl bg-sky-500 text-white font-medium disabled:opacity-50">
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

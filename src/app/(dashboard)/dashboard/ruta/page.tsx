'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { marcaLabel, estadoVisitaColor } from '@/lib/utils';
import { registrarBitacora } from '@/lib/bitacora';
import type { Sucursal, Perfil, VisitaProgramada } from '@/types/database';

type FilaRuta = Sucursal & {
  visitaHoy?: VisitaProgramada | null;
};

export default function RutaPage() {
  const [filas, setFilas] = useState<FilaRuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [selected, setSelected] = useState<FilaRuta | null>(null);
  const [modoCierre, setModoCierre] = useState<'completa' | 'parcial'>('completa');
  const [trabajo, setTrabajo] = useState('');
  const [obs, setObs] = useState('');
  const [airesPendientes, setAiresPendientes] = useState(0);
  const [miniPend, setMiniPend] = useState(0);
  const [grandesPend, setGrandesPend] = useState(0);
  const [bombasPend, setBombasPend] = useState(0);
  const [evidencias, setEvidencias] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const puedeCerrar = perfil?.rol === 'admin' || perfil?.rol === 'tecnico';
  const hoy = new Date().toISOString().split('T')[0];

  const load = async () => {
    setLoading(true);
    const [{ data: sucs }, { data: visitas }, { data: { user } }] = await Promise.all([
      supabase.from('sucursales').select('*').eq('activa', true).order('orden_ciclo'),
      supabase
        .from('visitas_programadas')
        .select('*')
        .eq('fecha_programada', hoy)
        .in('estado', ['pendiente', 'en_progreso', 'parcial', 'completada']),
      supabase.auth.getUser(),
    ]);

    const bySuc = new Map<string, VisitaProgramada>();
    for (const v of visitas || []) {
      const prev = bySuc.get(v.sucursal_id);
      // Preferir no-completada; si hay varias, la más reciente
      if (!prev || (prev.estado === 'completada' && v.estado !== 'completada')) {
        bySuc.set(v.sucursal_id, v);
      }
    }

    const list: FilaRuta[] = (sucs || []).map((s) => ({
      ...s,
      visitaHoy: bySuc.get(s.id) || null,
    }));

    setFilas(list);
    if (user) {
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
      setPerfil(p);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const moverAlFinal = async (sucursalId: string) => {
    const { data: todas } = await supabase
      .from('sucursales')
      .select('id, orden_ciclo')
      .order('orden_ciclo');
    const list = todas || [];
    const max = list.length > 0 ? Math.max(...list.map((x) => x.orden_ciclo || 0)) : 0;
    await supabase.from('sucursales').update({ orden_ciclo: max + 1 }).eq('id', sucursalId);
    // Renumerar 1..n en orden
    const { data: ordenadas } = await supabase
      .from('sucursales')
      .select('id')
      .order('orden_ciclo');
    for (let i = 0; i < (ordenadas || []).length; i++) {
      await supabase.from('sucursales').update({ orden_ciclo: i + 1 }).eq('id', ordenadas![i].id);
    }
  };

  const abrirCierre = (f: FilaRuta, modo: 'completa' | 'parcial') => {
    setSelected(f);
    setModoCierre(modo);
    setTrabajo('');
    setObs('');
    setAiresPendientes(0);
    setMiniPend(0);
    setGrandesPend(0);
    setBombasPend(0);
    setEvidencias([]);
  };

  const guardarCierre = async () => {
    if (!selected) return;
    setSaving(true);
    const sucursalId = selected.id;
    const nombre = selected.nombre;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const estado = modoCierre === 'completa' ? 'completada' : 'parcial';
      const payload: Record<string, unknown> = {
        tecnico_id: user?.id,
        trabajo_realizado: trabajo,
        observaciones: obs,
        fecha_fin: new Date().toISOString(),
        estado,
        aires_pendientes: modoCierre === 'completa' ? 0 : airesPendientes,
        mini_split_pendientes: modoCierre === 'completa' ? 0 : miniPend,
        equipos_grandes_pendientes: modoCierre === 'completa' ? 0 : grandesPend,
        bombas_pendientes: modoCierre === 'completa' ? 0 : bombasPend,
      };

      let visitaId = selected.visitaHoy?.id;

      if (visitaId) {
        const { error } = await supabase
          .from('visitas_programadas')
          .update(payload)
          .eq('id', visitaId);
        if (error) throw error;
      } else {
        const { data: nueva, error } = await supabase
          .from('visitas_programadas')
          .insert({
            sucursal_id: sucursalId,
            fecha_programada: hoy,
            orden_del_dia: selected.orden_ciclo || 1,
            es_emergencia: false,
            ...payload,
          })
          .select()
          .single();
        if (error) throw error;
        visitaId = nueva?.id;
      }

      // Evidencias
      if (visitaId && evidencias.length > 0) {
        try {
          for (const file of evidencias) {
            const ext = file.name.split('.').pop() || 'jpg';
            const path = `visitas/${visitaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { error: upErr } = await supabase.storage.from('archivos').upload(path, file);
            if (!upErr) {
              const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path);
              await supabase.from('archivos_visita').insert({
                visita_id: visitaId,
                url: urlData.publicUrl,
                tipo: file.type.startsWith('video') ? 'video' : 'imagen',
                nombre_archivo: file.name,
              });
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (modoCierre === 'completa') {
        await moverAlFinal(sucursalId);
        try {
          await supabase
            .from('problemas')
            .update({
              estado: 'resuelto',
              fecha_resolucion: new Date().toISOString(),
              resuelto_por: user?.id,
              notas_resolucion: trabajo || 'Resuelto con el mantenimiento',
            })
            .eq('sucursal_id', sucursalId)
            .eq('estado', 'abierto');
        } catch {
          /* ignore */
        }
      }

      await registrarBitacora(
        modoCierre === 'completa' ? 'completar_visita' : 'cierre_parcial',
        'sucursales',
        sucursalId,
        nombre
      );
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
      setSelected(null);
      setEvidencias([]);
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Ruta del día</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Todas las sucursales activas. La de arriba es la siguiente. Al terminar, pasa al final de la cola.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : filas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">
          No hay sucursales activas. Agrégalas en Sucursales.
        </div>
      ) : (
        <div className="space-y-3">
          {filas.map((f, idx) => {
            const estado = f.visitaHoy?.estado;
            const esSiguiente = idx === 0 && estado !== 'completada';
            return (
              <div
                key={f.id}
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-sm transition ${
                  esSiguiente ? 'border-sky-300 ring-2 ring-sky-100' : 'border-slate-100'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                      esSiguiente ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {f.orden_ciclo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-800">{f.nombre}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          f.marca === 'le_cafe' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {marcaLabel(f.marca)}
                      </span>
                      {esSiguiente && (
                        <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                          Siguiente
                        </span>
                      )}
                      {estado && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${estadoVisitaColor(estado)}`}>
                          {estado.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 break-words">{f.direccion}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {f.cantidad_mini_split} Mini Split · {f.cantidad_equipos_grandes} grandes ·{' '}
                      {f.cantidad_bombas_condensacion} bombas
                    </p>
                    {estado === 'parcial' && f.visitaHoy && (
                      <p className="text-xs text-amber-600 mt-1">
                        Pendiente: {f.visitaHoy.aires_pendientes || 0} aires
                        {(f.visitaHoy.mini_split_pendientes || 0) > 0 && ` · ${f.visitaHoy.mini_split_pendientes} mini`}
                        {(f.visitaHoy.equipos_grandes_pendientes || 0) > 0 && ` · ${f.visitaHoy.equipos_grandes_pendientes} grandes`}
                        {(f.visitaHoy.bombas_pendientes || 0) > 0 && ` · ${f.visitaHoy.bombas_pendientes} bombas`}
                      </p>
                    )}
                  </div>
                  {puedeCerrar && estado !== 'completada' && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        onClick={() => abrirCierre(f, 'completa')}
                        className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium"
                      >
                        Terminado
                      </button>
                      <button
                        onClick={() => abrirCierre(f, 'parcial')}
                        className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 font-medium"
                      >
                        Parcial
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-lg">
                {modoCierre === 'completa' ? 'Marcar terminada' : 'Cierre parcial'}
              </h3>
              <p className="text-sm text-slate-500">{selected.nombre}</p>
              {modoCierre === 'completa' && (
                <p className="text-xs text-sky-600 mt-1">Al guardar, esta sucursal pasará al final de la cola.</p>
              )}
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trabajo realizado</label>
                <textarea value={trabajo} onChange={(e) => setTrabajo(e.target.value)} rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none resize-none text-base"
                  placeholder="Qué se hizo..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
                <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none resize-none text-base" />
              </div>
              {modoCierre === 'parcial' && (
                <div className="space-y-3 p-3 bg-amber-50 rounded-xl">
                  <p className="text-sm font-medium text-amber-800">Qué falta por hacer</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-600">Total aires</label>
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
                    <div>
                      <label className="text-xs text-slate-600">Bombas / condensadores</label>
                      <input type="number" min={0} value={bombasPend}
                        onChange={(e) => setBombasPend(+e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-base" />
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Evidencias (opcional)</label>
                <input type="file" accept="image/*,video/*" multiple
                  onChange={(e) => setEvidencias(e.target.files ? Array.from(e.target.files) : [])}
                  className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-sky-50 file:text-sky-700" />
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
    </div>
  );
}

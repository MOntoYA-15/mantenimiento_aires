'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { marcaLabel } from '@/lib/utils';
import { registrarBitacora } from '@/lib/bitacora';
import { resolveFiles, prepareFilesForUpload } from '@/lib/storage';
import type { Sucursal, Perfil, VisitaProgramada } from '@/types/database';

type Fila = Sucursal & {
  visitaHoy?: VisitaProgramada | null;
  esEmergencia?: boolean;
  problemas?: any[];
};

export default function RutaPage() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [selected, setSelected] = useState<Fila | null>(null);
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
  const _d = new Date();
  const hoy = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;

  const load = async () => {
    setLoading(true);
    const [
      { data: sucs },
      { data: visitasHoy },
      { data: emergenciasActivas },
      { data: probs },
      { data: { user } },
    ] = await Promise.all([
      supabase.from('sucursales').select('*').eq('activa', true).order('orden_ciclo'),
      supabase.from('visitas_programadas').select('*').eq('fecha_programada', hoy),
      supabase
        .from('visitas_programadas')
        .select('*')
        .eq('es_emergencia', true)
        .in('estado', ['pendiente', 'en_progreso', 'parcial']),
      supabase
        .from('problemas')
        .select('*')
        .eq('estado', 'abierto')
        .order('prioridad'),
      supabase.auth.getUser(),
    ]);

    // Archivos de problemas
    const probsWithFiles = await Promise.all(
      (probs || []).map(async (pr) => {
        const { data: archs } = await supabase
          .from('archivos_problema')
          .select('*')
          .eq('problema_id', pr.id);
        let archivos = archs || [];
        if (archivos.length) {
          const resolved = await resolveFiles(archivos);
          archivos = resolved.map((a) => ({ ...a, url: a.viewUrl }));
        }
        return { ...pr, archivos };
      })
    );

    const emergBySuc = new Map<string, VisitaProgramada>();
    for (const e of emergenciasActivas || []) {
      emergBySuc.set(e.sucursal_id, e);
    }

    const visitaBySuc = new Map<string, VisitaProgramada>();
    for (const v of visitasHoy || []) {
      const prev = visitaBySuc.get(v.sucursal_id);
      if (!prev || (prev.estado === 'completada' && v.estado !== 'completada')) {
        visitaBySuc.set(v.sucursal_id, v);
      } else if (prev.estado !== 'completada' && v.estado === 'completada') {
        // keep pending
      } else if ((v.created_at || '') > (prev.created_at || '')) {
        visitaBySuc.set(v.sucursal_id, v);
      }
    }

    // Si hay emergencia, usarla como visita de la sucursal
    for (const [sid, e] of emergBySuc) {
      const actual = visitaBySuc.get(sid);
      if (!actual || actual.estado === 'completada' || e.es_emergencia) {
        visitaBySuc.set(sid, e);
      }
    }

    const probsBySuc = new Map<string, any[]>();
    for (const pr of probsWithFiles) {
      const list = probsBySuc.get(pr.sucursal_id) || [];
      list.push(pr);
      probsBySuc.set(pr.sucursal_id, list);
    }

    const mapped: Fila[] = (sucs || []).map((s) => {
      const visita = visitaBySuc.get(s.id) || null;
      const tieneEmerg = emergBySuc.has(s.id);
      return {
        ...s,
        visitaHoy: visita,
        esEmergencia: tieneEmerg || !!visita?.es_emergencia,
        problemas: probsBySuc.get(s.id) || [],
      };
    });

    // Orden: 1) emergencias no completadas  2) problemas prio 1-2  3) resto por orden_ciclo
    // Excluir de "siguiente" solo si visita de HOY está completada Y no hay emergencia pendiente
    const pendientes = mapped.filter((f) => {
      if (f.esEmergencia) return true;
      if (f.visitaHoy?.estado === 'completada') return false;
      return true;
    });

    pendientes.sort((a, b) => {
      const score = (f: Fila) => {
        if (f.esEmergencia) return 0;
        if (f.problemas?.some((p) => p.prioridad === '1' || p.prioridad === '2')) return 1;
        return 2;
      };
      const sa = score(a);
      const sb = score(b);
      if (sa !== sb) return sa - sb;
      return Number(a.orden_ciclo || 0) - Number(b.orden_ciclo || 0);
    });

    setFilas(pendientes);
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
      .eq('activa', true)
      .order('orden_ciclo');
    const list = (todas || []).filter((x) => x.id !== sucursalId);
    for (let i = 0; i < list.length; i++) {
      await supabase.from('sucursales').update({ orden_ciclo: i + 1 }).eq('id', list[i].id);
    }
    await supabase.from('sucursales').update({ orden_ciclo: list.length + 1 }).eq('id', sucursalId);
  };

  const abrirCierre = (f: Fila, modo: 'completa' | 'parcial') => {
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

      if (visitaId && selected.visitaHoy?.estado !== 'completada') {
        const { error } = await supabase.from('visitas_programadas').update(payload).eq('id', visitaId);
        if (error) throw error;
      } else {
        const { data: nueva, error } = await supabase
          .from('visitas_programadas')
          .insert({
            sucursal_id: sucursalId,
            fecha_programada: hoy,
            orden_del_dia: selected.orden_ciclo || 1,
            es_emergencia: !!selected.esEmergencia,
            ...payload,
          })
          .select()
          .single();
        if (error) throw error;
        visitaId = nueva?.id;
      }

      // Siempre cerrar TODAS las emergencias pendientes de esta sucursal al terminar
      if (modoCierre === 'completa') {
        const { data: emergs } = await supabase
          .from('visitas_programadas')
          .select('id')
          .eq('sucursal_id', sucursalId)
          .eq('es_emergencia', true)
          .in('estado', ['pendiente', 'en_progreso', 'parcial']);

        for (const em of emergs || []) {
          if (em.id === visitaId) continue;
          await supabase
            .from('visitas_programadas')
            .update({
              estado: 'completada',
              fecha_fin: new Date().toISOString(),
              tecnico_id: user?.id,
              trabajo_realizado: trabajo || 'Cerrada con el mantenimiento de ruta',
            })
            .eq('id', em.id);
        }

        // Cerrar problemas abiertos
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

        await moverAlFinal(sucursalId);
      }

      if (visitaId && evidencias.length > 0) {
        try {
          const prepared = await prepareFilesForUpload(evidencias);
          await Promise.all(
            prepared.map(async (file) => {
              const ext = file.name.split('.').pop() || 'jpg';
              const path =
                'visitas/' + visitaId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
              const { error: upErr } = await supabase.storage
                .from('archivos')
                .upload(path, file, { contentType: file.type });
              if (!upErr) {
                const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path);
                await supabase.from('archivos_visita').insert({
                  visita_id: visitaId,
                  url: urlData.publicUrl,
                  tipo: file.type.startsWith('video') ? 'video' : 'imagen',
                  nombre_archivo: file.name,
                });
              }
            })
          );
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
      await load();
    }
  };

  const siguiente = filas[0] || null;
  const proximas = filas.slice(1);
  const probsSiguiente = siguiente?.problemas || [];
  const esEmergenciaHoy = !!siguiente?.esEmergencia;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Ruta del día</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Las emergencias salen primero. Al terminar, se cierran también en Emergencias y Problemas.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : !siguiente ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <p className="text-slate-600 font-medium">No hay sucursales pendientes</p>
        </div>
      ) : (
        <div
          className={
            'bg-white rounded-2xl border-2 p-5 sm:p-6 shadow-sm ' +
            (esEmergenciaHoy ? 'border-red-400 ring-2 ring-red-100' : 'border-sky-300 ring-2 ring-sky-100')
          }
        >
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span
              className={
                'text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-lg ' +
                (esEmergenciaHoy ? 'text-red-700 bg-red-50' : 'text-sky-600 bg-sky-50')
              }
            >
              {esEmergenciaHoy ? 'Siguiente · Emergencia' : 'Siguiente'}
            </span>
            <span
              className={
                'text-xs px-2 py-1 rounded-full font-medium ' +
                (siguiente.marca === 'le_cafe' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')
              }
            >
              {marcaLabel(siguiente.marca)}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800">{siguiente.nombre}</h2>
          <p className="text-slate-500 mt-1">{siguiente.direccion}</p>
          <p className="text-sm text-slate-400 mt-2">
            {siguiente.cantidad_mini_split} Mini Split · {siguiente.cantidad_equipos_grandes} grandes ·{' '}
            {siguiente.cantidad_bombas_condensacion} bombas
          </p>

          {esEmergenciaHoy && (
            <p className="mt-3 text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2 font-medium">
              Emergencia prioritaria — atiende esta sucursal primero
            </p>
          )}

          {probsSiguiente.length > 0 && (
            <div className="mt-3 space-y-2">
              {probsSiguiente.map((pr: any) => (
                <div key={pr.id} className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm">
                  <div className="font-semibold text-amber-900">
                    Problema P{pr.prioridad}: {pr.titulo}
                  </div>
                  {pr.descripcion && <p className="text-amber-800/80 text-xs mt-1">{pr.descripcion}</p>}
                  {pr.archivos && pr.archivos.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {pr.archivos.map((a: any) =>
                        a.tipo === 'imagen' ? (
                          <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                            <img src={a.url} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                          </a>
                        ) : (
                          <a
                            key={a.id}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-16 h-16 bg-white rounded-lg flex items-center justify-center text-xl border"
                          >
                            🎬
                          </a>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {puedeCerrar && (
            <div className="flex flex-wrap gap-3 mt-5">
              <button
                onClick={() => abrirCierre(siguiente, 'completa')}
                className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium shadow-sm"
              >
                Terminado
              </button>
              <button
                onClick={() => abrirCierre(siguiente, 'parcial')}
                className="px-5 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-medium"
              >
                Parcial
              </button>
            </div>
          )}
        </div>
      )}

      {proximas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Siguen en la cola</h3>
          <div className="space-y-2">
            {proximas.map((f, idx) => (
              <div
                key={f.id}
                className={
                  'rounded-xl px-4 py-3 flex items-center gap-3 border ' +
                  (f.esEmergencia ? 'bg-red-50 border-red-100' : 'bg-slate-50/80 border-slate-100')
                }
              >
                <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-sm font-bold flex items-center justify-center shrink-0">
                  {idx + 2}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-700 truncate">
                    {f.nombre}
                    {f.esEmergencia && <span className="ml-2 text-xs text-red-600 font-semibold">Emergencia</span>}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{f.direccion}</div>
                </div>
              </div>
            ))}
          </div>
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
                <p className="text-xs text-sky-600 mt-1">
                  Al guardar se cierra también en Emergencias y Problemas, y pasa al final de la cola.
                </p>
              )}
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trabajo realizado</label>
                <textarea
                  value={trabajo}
                  onChange={(e) => setTrabajo(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none resize-none text-base"
                  placeholder="Qué se hizo..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none resize-none text-base"
                />
              </div>
              {modoCierre === 'parcial' && (
                <div className="space-y-3 p-3 bg-amber-50 rounded-xl">
                  <p className="text-sm font-medium text-amber-800">Qué falta por hacer</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-600">Total aires</label>
                      <input
                        type="number"
                        min={0}
                        value={airesPendientes}
                        onChange={(e) => setAiresPendientes(+e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-base"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Mini Split</label>
                      <input
                        type="number"
                        min={0}
                        value={miniPend}
                        onChange={(e) => setMiniPend(+e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-base"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Grandes</label>
                      <input
                        type="number"
                        min={0}
                        value={grandesPend}
                        onChange={(e) => setGrandesPend(+e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-base"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Bombas</label>
                      <input
                        type="number"
                        min={0}
                        value={bombasPend}
                        onChange={(e) => setBombasPend(+e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-base"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Evidencias (opcional)</label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => setEvidencias(e.target.files ? Array.from(e.target.files) : [])}
                  className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-sky-50 file:text-sky-700"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelected(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarCierre}
                  disabled={saving}
                  className={
                    'flex-1 py-3 rounded-xl text-white font-medium disabled:opacity-60 ' +
                    (modoCierre === 'completa' ? 'bg-green-500' : 'bg-amber-500')
                  }
                >
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

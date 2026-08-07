'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { marcaLabel } from '@/lib/utils';
import { registrarBitacora } from '@/lib/bitacora';
import { resolveFiles, prepareFilesForUpload } from '@/lib/storage';
import type { Sucursal, Perfil, VisitaProgramada } from '@/types/database';

type Fila = Sucursal & { visitaHoy?: VisitaProgramada | null };

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
  const [problemasAbiertos, setProblemasAbiertos] = useState<any[]>([]);
  const supabase = createClient();

  const puedeCerrar = perfil?.rol === 'admin' || perfil?.rol === 'tecnico';
  const _d = new Date();
  const hoy = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;

  const load = async () => {
    setLoading(true);
    const [{ data: sucs }, { data: visitasHoy }, { data: emergenciasActivas }, { data: { user } }] = await Promise.all([
      supabase.from('sucursales').select('*').eq('activa', true).order('orden_ciclo'),
      supabase.from('visitas_programadas').select('*').eq('fecha_programada', hoy),
      supabase.from('visitas_programadas').select('*').eq('es_emergencia', true).neq('estado', 'completada'),
      supabase.auth.getUser(),
    ]);
    // Unir visitas de hoy + emergencias pendientes (aunque sean de otro día)
    const visitas = [...(visitasHoy || [])];
    for (const e of emergenciasActivas || []) {
      if (!visitas.some((v) => v.id === e.id)) visitas.push(e);
    }

    const bySuc = new Map<string, VisitaProgramada>();
    for (const v of visitas || []) {
      const prev = bySuc.get(v.sucursal_id);
      if (!prev) {
        bySuc.set(v.sucursal_id, v);
        continue;
      }
      // Preferir pendientes sobre completadas
      if (prev.estado === 'completada' && v.estado !== 'completada') {
        bySuc.set(v.sucursal_id, v);
        continue;
      }
      if (prev.estado !== 'completada' && v.estado === 'completada') continue;
      // Preferir emergencias
      if (v.es_emergencia && !prev.es_emergencia) {
        bySuc.set(v.sucursal_id, v);
        continue;
      }
      if ((v.fecha_fin || v.created_at) > (prev.fecha_fin || prev.created_at)) {
        bySuc.set(v.sucursal_id, v);
      }
    }

    setFilas((sucs || []).map((s) => ({ ...s, visitaHoy: bySuc.get(s.id) || null })));
    const { data: probs } = await supabase
      .from('problemas')
      .select('*, archivos:archivos_problema(*)')
      .eq('estado', 'abierto')
      .order('prioridad');
    const withP = await Promise.all((probs || []).map(async (pr) => {
      if (pr.archivos?.length) {
        const archivos = await resolveFiles(pr.archivos);
        return { ...pr, archivos: archivos.map((a: any) => ({ ...a, url: a.viewUrl })) };
      }
      return pr;
    }));
    setProblemasAbiertos(withP);
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
            es_emergencia: false,
            ...payload,
          })
          .select()
          .single();
        if (error) throw error;
        visitaId = nueva?.id;
      }

      if (visitaId && evidencias.length > 0) {
        try {
          const prepared = await prepareFilesForUpload(evidencias);
          await Promise.all(prepared.map(async (file) => {
            const ext = file.name.split('.').pop() || 'jpg';
            const path = 'visitas/' + visitaId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
            const { error: upErr } = await supabase.storage.from('archivos').upload(path, file, { contentType: file.type });
            if (!upErr) {
              const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path);
              await supabase.from('archivos_visita').insert({
                visita_id: visitaId,
                url: urlData.publicUrl,
                tipo: file.type.startsWith('video') ? 'video' : 'imagen',
                nombre_archivo: file.name,
              });
            }
          }));
        } catch { /* ignore */ }
      }

      if (modoCierre === 'completa') {
        await moverAlFinal(sucursalId);
        // Cerrar problemas abiertos de esta sucursal
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
        } catch { /* ignore */ }
        // Cerrar TODAS las emergencias pendientes de esta sucursal
        try {
          await supabase
            .from('visitas_programadas')
            .update({
              estado: 'completada',
              fecha_fin: new Date().toISOString(),
              tecnico_id: user?.id,
              trabajo_realizado: trabajo || 'Cerrada desde ruta del día',
            })
            .eq('sucursal_id', sucursalId)
            .eq('es_emergencia', true)
            .neq('estado', 'completada');
        } catch { /* ignore */ }
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

  // Emergencias y prioridad alta primero, luego el orden normal de la cola
  const pendientes = filas.filter((f) => f.visitaHoy?.estado !== 'completada');
  const rank = (f: Fila) => {
    if (f.visitaHoy?.es_emergencia) return 0;
    const pr = problemasAbiertos.find((p) => p.sucursal_id === f.id);
    if (pr && (pr.prioridad === '1' || pr.prioridad === '2')) return 1;
    return 2;
  };
  const pendientesOrdenados = [...pendientes].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (a.orden_ciclo || 0) - (b.orden_ciclo || 0);
  });
  const siguiente = pendientesOrdenados[0] || null;
  const probsSiguiente = problemasAbiertos.filter((p) => p.sucursal_id === siguiente?.id);
  const esEmergenciaHoy = !!(siguiente?.visitaHoy?.es_emergencia || probsSiguiente.some((p) => p.prioridad === '1' || p.prioridad === '2'));
  const proximas = pendientesOrdenados.slice(1);
  const completadasHoy = filas
    .filter((f) => f.visitaHoy?.estado === 'completada')
    .sort((a, b) => {
      const ta = a.visitaHoy?.fecha_fin || a.visitaHoy?.created_at || '';
      const tb = b.visitaHoy?.fecha_fin || b.visitaHoy?.created_at || '';
      return tb.localeCompare(ta);
    });

  const formatFecha = (iso?: string) => {
    if (!iso) return hoy;
    try {
      return new Date(iso).toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Ruta del día</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Solo la siguiente sucursal. Al terminarla, pasa al final de la cola.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : !siguiente ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <p className="text-slate-600 font-medium">No hay sucursales pendientes</p>
          <p className="text-sm text-slate-400 mt-1">Revisa completadas de hoy o el historial</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-sky-300 ring-2 ring-sky-100 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-600 bg-sky-50 px-2 py-1 rounded-lg">
              Ahora · orden {siguiente.orden_ciclo}
            </span>
            <span className={'text-xs px-2 py-1 rounded-full font-medium ' + (siguiente.marca === 'le_cafe' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')}>
              {marcaLabel(siguiente.marca)}
            </span>
            {siguiente.visitaHoy?.estado === 'parcial' && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">Parcial</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{siguiente.nombre}</h2>
          {esEmergenciaHoy && (
            <p className="mt-2 text-sm text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-200 rounded-xl px-3 py-2 font-medium">
              ⚡ Emergencia prioritaria en esta sucursal
            </p>
          )}
          {probsSiguiente.length > 0 && (
            <div className="mt-3 space-y-2">
              {probsSiguiente.map((pr: any) => (
                <div key={pr.id} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-3 text-sm">
                  <div className="font-semibold text-amber-900 dark:text-amber-200">Problema: {pr.titulo}</div>
                  <p className="text-amber-800/80 dark:text-amber-300/80 text-xs mt-1">{pr.descripcion}</p>
                  {pr.archivos && pr.archivos.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {pr.archivos.map((a: any) =>
                        a.tipo === 'imagen' ? (
                          <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                            <img src={a.url} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                          </a>
                        ) : (
                          <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
                            className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-xl border">🎬</a>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-slate-500 mt-1">{siguiente.direccion}</p>
          <p className="text-sm text-slate-400 mt-2">
            {siguiente.cantidad_mini_split} Mini Split · {siguiente.cantidad_equipos_grandes} grandes · {siguiente.cantidad_bombas_condensacion} bombas
          </p>
          {siguiente.visitaHoy?.estado === 'parcial' && (
            <p className="text-sm text-amber-700 mt-2 bg-amber-50 rounded-xl px-3 py-2">
              Pendiente: {siguiente.visitaHoy.aires_pendientes || 0} aires
              {(siguiente.visitaHoy.mini_split_pendientes || 0) > 0 && (' · ' + siguiente.visitaHoy.mini_split_pendientes + ' mini')}
              {(siguiente.visitaHoy.equipos_grandes_pendientes || 0) > 0 && (' · ' + siguiente.visitaHoy.equipos_grandes_pendientes + ' grandes')}
              {(siguiente.visitaHoy.bombas_pendientes || 0) > 0 && (' · ' + siguiente.visitaHoy.bombas_pendientes + ' bombas')}
            </p>
          )}
          {puedeCerrar && (
            <div className="flex flex-wrap gap-3 mt-5">
              <button onClick={() => abrirCierre(siguiente, 'completa')}
                className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium shadow-sm">
                Terminado
              </button>
              <button onClick={() => abrirCierre(siguiente, 'parcial')}
                className="px-5 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-medium">
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
            {proximas.map((f) => (
              <div key={f.id} className="bg-slate-50/80 border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 text-sm font-bold flex items-center justify-center shrink-0">
                  {f.orden_ciclo}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-700 truncate">{f.nombre}</div>
                  <div className="text-xs text-slate-400 truncate">{f.direccion}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completadasHoy.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Completadas hoy</h3>
          <div className="space-y-2">
            {completadasHoy.map((f) => (
              <div key={f.id} className="bg-green-50/50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-green-600 text-lg">✓</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800 truncate">{f.nombre}</div>
                  <div className="text-xs text-slate-500">
                    {formatFecha(f.visitaHoy?.fecha_fin || f.visitaHoy?.created_at)}
                    {f.visitaHoy?.trabajo_realizado && (
                      <span className="text-slate-400"> · {f.visitaHoy.trabajo_realizado.slice(0, 60)}</span>
                    )}
                  </div>
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
                <p className="text-xs text-sky-600 mt-1">Al guardar, irá al final de la cola y saldrá la siguiente.</p>
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
                      <input type="number" min={0} value={airesPendientes} onChange={(e) => setAiresPendientes(+e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-base" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Mini Split</label>
                      <input type="number" min={0} value={miniPend} onChange={(e) => setMiniPend(+e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-base" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Grandes</label>
                      <input type="number" min={0} value={grandesPend} onChange={(e) => setGrandesPend(+e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-base" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Bombas</label>
                      <input type="number" min={0} value={bombasPend} onChange={(e) => setBombasPend(+e.target.value)}
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
                <button onClick={() => setSelected(null)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600">Cancelar</button>
                <button onClick={guardarCierre} disabled={saving}
                  className={'flex-1 py-3 rounded-xl text-white font-medium disabled:opacity-60 ' + (modoCierre === 'completa' ? 'bg-green-500' : 'bg-amber-500')}>
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

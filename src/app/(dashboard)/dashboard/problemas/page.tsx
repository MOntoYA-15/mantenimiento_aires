'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { marcaLabel, prioridadColor } from '@/lib/utils';
import type { Problema, Sucursal, PrioridadEmergencia } from '@/types/database';

export default function ProblemasPage() {
  const [problemas, setProblemas] = useState<(Problema & { sucursal?: Sucursal })[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sucursal_id: '',
    titulo: '',
    descripcion: '',
    prioridad: '3' as PrioridadEmergencia,
  });
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const [{ data: probs }, { data: sucs }] = await Promise.all([
      supabase
        .from('problemas')
        .select('*, sucursal:sucursales(*), archivos:archivos_problema(*)')
        .order('created_at', { ascending: false }),
      supabase.from('sucursales').select('*').eq('activa', true).order('nombre'),
    ]);
    setProblemas(probs || []);
    setSucursales(sucs || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: problema, error } = await supabase
      .from('problemas')
      .insert({
        ...form,
        reportado_por: user.id,
      })
      .select()
      .single();

    if (error || !problema) {
      alert('Error al crear el problema');
      setSaving(false);
      return;
    }

    // Subir archivos a Supabase Storage
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `problemas/${problema.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('archivos')
        .upload(path, file);

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path);
        const tipo = file.type.startsWith('video') ? 'video' : 'imagen';
        await supabase.from('archivos_problema').insert({
          problema_id: problema.id,
          url: urlData.publicUrl,
          tipo,
          nombre_archivo: file.name,
          tamanio_bytes: file.size,
        });
      }
    }

    setSaving(false);
    setShowModal(false);
    setForm({ sucursal_id: '', titulo: '', descripcion: '', prioridad: '3' });
    setFiles([]);
    load();
  };

  const convertirEmergencia = async (p: Problema) => {
    if (!confirm(`¿Crear visita de emergencia (prioridad ${p.prioridad}) para esta sucursal hoy?`)) return;

    const hoy = new Date().toISOString().split('T')[0];
    const { data: visita } = await supabase
      .from('visitas_programadas')
      .insert({
        sucursal_id: p.sucursal_id,
        fecha_programada: hoy,
        orden_del_dia: 0, // se pone al inicio
        estado: 'pendiente',
        es_emergencia: true,
        prioridad_emergencia: p.prioridad,
      })
      .select()
      .single();

    if (visita) {
      await supabase
        .from('problemas')
        .update({ convertido_a_emergencia: true, visita_emergencia_id: visita.id })
        .eq('id', p.id);
    }
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Problemas reportados</h1>
          <p className="text-slate-500 mt-1">Reportes de gerentes, técnicos y administradores</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium shadow-lg shadow-sky-200"
        >
          + Reportar problema
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : problemas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
          No hay problemas reportados
        </div>
      ) : (
        <div className="space-y-3">
          {problemas.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${prioridadColor(p.prioridad)}`}>
                      Prioridad {p.prioridad}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.estado === 'abierto' ? 'bg-amber-100 text-amber-800' :
                      p.estado === 'resuelto' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {p.estado}
                    </span>
                    {p.convertido_a_emergencia && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Emergencia creada</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-800">{p.titulo}</h3>
                  <p className="text-sm text-slate-600 mt-1">{p.descripcion}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {p.sucursal?.nombre} ({p.sucursal && marcaLabel(p.sucursal.marca)}) ·{' '}
                    {new Date(p.created_at).toLocaleDateString('es-MX')}
                  </p>

                  {/* Archivos */}
                  {p.archivos && p.archivos.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {p.archivos.map((a) =>
                        a.tipo === 'imagen' ? (
                          <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                            <img src={a.url} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                          </a>
                        ) : (
                          <a
                            key={a.id}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-2xl border"
                          >
                            🎬
                          </a>
                        )
                      )}
                    </div>
                  )}
                </div>
                {p.estado === 'abierto' && !p.convertido_a_emergencia && (
                  <button
                    onClick={() => convertirEmergencia(p)}
                    className="text-sm px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 shrink-0"
                  >
                    Crear emergencia
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo problema */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-semibold text-lg">Reportar problema</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sucursal</label>
                <select
                  required
                  value={form.sucursal_id}
                  onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-sky-400"
                >
                  <option value="">Seleccionar...</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} ({marcaLabel(s.marca)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                <input
                  required
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-sky-400"
                  placeholder="Ej: Fuga de gas en mini split de cocina"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  required
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-sky-400 resize-none"
                  placeholder="Describe el problema con detalle..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prioridad de emergencia (1 = más urgente)
                </label>
                <div className="flex gap-2">
                  {(['1', '2', '3', '4', '5'] as PrioridadEmergencia[]).map((pr) => (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => setForm({ ...form, prioridad: pr })}
                      className={`w-10 h-10 rounded-xl font-bold text-sm transition ${
                        form.prioridad === pr
                          ? prioridadColor(pr)
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {pr}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Imágenes o videos del problema
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileChange}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-sky-50 file:text-sky-700 file:font-medium hover:file:bg-sky-100"
                />
                {files.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1">{files.length} archivo(s) seleccionado(s)</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-600 disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Reportar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

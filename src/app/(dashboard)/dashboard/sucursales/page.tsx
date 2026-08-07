'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { marcaLabel } from '@/lib/utils';
import type { Sucursal, MarcaSucursal } from '@/types/database';

const emptyForm = {
  nombre: '',
  marca: 'le_cafe' as MarcaSucursal,
  direccion: '',
  ciudad: '',
  cantidad_mini_split: 0,
  cantidad_equipos_grandes: 0,
  cantidad_bombas_condensacion: 0,
  notas: '',
};

export default function SucursalesPage() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Sucursal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('sucursales').select('*').order('orden_ciclo');
    setSucursales(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (s: Sucursal) => {
    setEditing(s);
    setForm({
      nombre: s.nombre,
      marca: s.marca,
      direccion: s.direccion,
      ciudad: s.ciudad || '',
      cantidad_mini_split: s.cantidad_mini_split,
      cantidad_equipos_grandes: s.cantidad_equipos_grandes,
      cantidad_bombas_condensacion: s.cantidad_bombas_condensacion,
      notas: s.notas || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editing) {
      await supabase
        .from('sucursales')
        .update({
          nombre: form.nombre,
          marca: form.marca,
          direccion: form.direccion,
          ciudad: form.ciudad,
          cantidad_mini_split: form.cantidad_mini_split,
          cantidad_equipos_grandes: form.cantidad_equipos_grandes,
          cantidad_bombas_condensacion: form.cantidad_bombas_condensacion,
          notas: form.notas,
        })
        .eq('id', editing.id);
    } else {
      const maxOrden =
        sucursales.length > 0 ? Math.max(...sucursales.map((s) => s.orden_ciclo || 0)) : 0;
      await supabase.from('sucursales').insert({
        nombre: form.nombre,
        marca: form.marca,
        direccion: form.direccion,
        ciudad: form.ciudad,
        cantidad_mini_split: form.cantidad_mini_split,
        cantidad_equipos_grandes: form.cantidad_equipos_grandes,
        cantidad_bombas_condensacion: form.cantidad_bombas_condensacion,
        notas: form.notas,
        orden_ciclo: maxOrden + 1,
        tiempo_estimado_minutos: 60,
        activa: true,
      });
    }
    setSaving(false);
    setShowModal(false);
    load();
  };

  const toggleActiva = async (s: Sucursal) => {
    await supabase.from('sucursales').update({ activa: !s.activa }).eq('id', s.id);
    load();
  };

  const eliminar = async (s: Sucursal) => {
    if (!confirm(`¿Eliminar la sucursal "${s.nombre}"?`)) return;
    await supabase.from('sucursales').delete().eq('id', s.id);
    load();
  };

  /** Reordena 1, 2, 3… sin duplicados */
  const renumerar = async () => {
    if (!confirm('¿Renumerar el orden del ciclo (1, 2, 3…) sin duplicados?')) return;
    const { data } = await supabase.from('sucursales').select('*').order('orden_ciclo');
    const list = data || [];
    for (let i = 0; i < list.length; i++) {
      await supabase.from('sucursales').update({ orden_ciclo: i + 1 }).eq('id', list[i].id);
    }
    load();
  };

  const mover = async (s: Sucursal, dir: -1 | 1) => {
    const sorted = [...sucursales].sort((a, b) => a.orden_ciclo - b.orden_ciclo);
    const idx = sorted.findIndex((x) => x.id === s.id);
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    const other = sorted[j];
    await supabase.from('sucursales').update({ orden_ciclo: other.orden_ciclo }).eq('id', s.id);
    await supabase.from('sucursales').update({ orden_ciclo: s.orden_ciclo }).eq('id', other.id);
    // Normalize
    const { data } = await supabase.from('sucursales').select('*').order('orden_ciclo');
    const list = data || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].orden_ciclo !== i + 1) {
        await supabase.from('sucursales').update({ orden_ciclo: i + 1 }).eq('id', list[i].id);
      }
    }
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Sucursales</h1>
          <p className="text-slate-500 mt-1 text-sm">
            El orden define la cola de la ruta: la de arriba se atiende primero
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={renumerar}
            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
          >
            Corregir órdenes
          </button>
          <button
            onClick={openNew}
            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium shadow-lg shadow-sky-200/50 text-sm"
          >
            + Nueva sucursal
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400">Cargando...</div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {sucursales.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 font-bold text-sm flex items-center justify-center shrink-0">
                      {s.orden_ciclo}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800">{s.nombre}</div>
                      <div className="text-xs text-slate-400 break-words">{s.direccion}</div>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                      s.marca === 'le_cafe' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {marcaLabel(s.marca)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                  <div>Mini: <strong>{s.cantidad_mini_split}</strong></div>
                  <div>Grandes: <strong>{s.cantidad_equipos_grandes}</strong></div>
                  <div>Bombas: <strong>{s.cantidad_bombas_condensacion}</strong></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => mover(s, -1)} className="text-xs px-2 py-1.5 bg-slate-50 rounded-lg">↑</button>
                  <button onClick={() => mover(s, 1)} className="text-xs px-2 py-1.5 bg-slate-50 rounded-lg">↓</button>
                  <button onClick={() => openEdit(s)} className="text-xs px-3 py-1.5 bg-sky-50 text-sky-700 rounded-lg">Editar</button>
                  <button onClick={() => toggleActiva(s)} className={`text-xs px-3 py-1.5 rounded-lg ${s.activa ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {s.activa ? 'Activa' : 'Inactiva'}
                  </button>
                  <button onClick={() => eliminar(s)} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg">Eliminar</button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">Orden</th>
                    <th className="px-4 py-3 font-medium">Sucursal</th>
                    <th className="px-4 py-3 font-medium">Marca</th>
                    <th className="px-4 py-3 font-medium text-center">Mini</th>
                    <th className="px-4 py-3 font-medium text-center">Grandes</th>
                    <th className="px-4 py-3 font-medium text-center">Bombas</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sucursales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => mover(s, -1)} className="text-slate-400 hover:text-slate-700 px-1">↑</button>
                          <span className="font-bold text-slate-700 w-6 text-center">{s.orden_ciclo}</span>
                          <button onClick={() => mover(s, 1)} className="text-slate-400 hover:text-slate-700 px-1">↓</button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{s.nombre}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[220px]">{s.direccion}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          s.marca === 'le_cafe' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>{marcaLabel(s.marca)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">{s.cantidad_mini_split}</td>
                      <td className="px-4 py-3 text-center">{s.cantidad_equipos_grandes}</td>
                      <td className="px-4 py-3 text-center">{s.cantidad_bombas_condensacion}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActiva(s)} className={`text-xs px-2 py-1 rounded-full ${s.activa ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {s.activa ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                        <button onClick={() => openEdit(s)} className="text-sky-600 hover:underline">Editar</button>
                        <button onClick={() => eliminar(s)} className="text-red-500 hover:underline">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sucursales.length === 0 && (
              <p className="p-8 text-center text-slate-400">No hay sucursales. Agrega la primera.</p>
            )}
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="font-semibold text-lg text-slate-800">
                {editing ? 'Editar sucursal' : 'Nueva sucursal'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 text-2xl p-1">×</button>
            </div>
            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 outline-none text-base"
                  placeholder="Ej: Le Café Centro" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                <select value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value as MarcaSucursal })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-base">
                  <option value="le_cafe">Le Café</option>
                  <option value="punta_brasas">Punta Brasas</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                <input required value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
                <input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-base" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mini Split</label>
                  <input type="number" min={0} value={form.cantidad_mini_split}
                    onChange={(e) => setForm({ ...form, cantidad_mini_split: +e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-base" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Equipos grandes</label>
                  <input type="number" min={0} value={form.cantidad_equipos_grandes}
                    onChange={(e) => setForm({ ...form, cantidad_equipos_grandes: +e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-base" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bombas</label>
                  <input type="number" min={0} value={form.cantidad_bombas_condensacion}
                    onChange={(e) => setForm({ ...form, cantidad_bombas_condensacion: +e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-base" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none resize-none text-base" />
              </div>
              {!editing && (
                <p className="text-xs text-slate-400">
                  El orden se asigna automáticamente al final de la cola. Puedes reordenar después con ↑ ↓.
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-600 disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

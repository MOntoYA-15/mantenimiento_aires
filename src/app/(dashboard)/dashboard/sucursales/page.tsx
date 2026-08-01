'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMinutos, marcaLabel } from '@/lib/utils';
import type { Sucursal, MarcaSucursal } from '@/types/database';

const emptyForm = {
  nombre: '',
  marca: 'le_cafe' as MarcaSucursal,
  direccion: '',
  ciudad: '',
  cantidad_mini_split: 0,
  cantidad_equipos_grandes: 0,
  cantidad_bombas_condensacion: 0,
  tiempo_estimado_minutos: 60,
  orden_ciclo: 0,
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
    const { data } = await supabase
      .from('sucursales')
      .select('*')
      .order('orden_ciclo');
    setSucursales(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      orden_ciclo: sucursales.length > 0 ? Math.max(...sucursales.map((s) => s.orden_ciclo)) + 1 : 1,
    });
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
      tiempo_estimado_minutos: s.tiempo_estimado_minutos,
      orden_ciclo: s.orden_ciclo,
      notas: s.notas || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editing) {
      await supabase.from('sucursales').update(form).eq('id', editing.id);
    } else {
      await supabase.from('sucursales').insert(form);
    }

    setSaving(false);
    setShowModal(false);
    load();
  };

  const toggleActiva = async (s: Sucursal) => {
    await supabase.from('sucursales').update({ activa: !s.activa }).eq('id', s.id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sucursales</h1>
          <p className="text-slate-500 mt-1">Le Café y Punta Brasas · gestión de equipos</p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium shadow-lg shadow-sky-200 transition"
        >
          + Nueva sucursal
        </button>
      </div>

      {loading ? (
        <div className="text-slate-400">Cargando...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Orden</th>
                  <th className="px-4 py-3 font-medium">Sucursal</th>
                  <th className="px-4 py-3 font-medium">Marca</th>
                  <th className="px-4 py-3 font-medium">Mini Split</th>
                  <th className="px-4 py-3 font-medium">Equipos grandes</th>
                  <th className="px-4 py-3 font-medium">Bombas</th>
                  <th className="px-4 py-3 font-medium">Tiempo est.</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sucursales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-600">{s.orden_ciclo}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{s.nombre}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[200px]">{s.direccion}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        s.marca === 'le_cafe' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {marcaLabel(s.marca)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{s.cantidad_mini_split}</td>
                    <td className="px-4 py-3 text-center">{s.cantidad_equipos_grandes}</td>
                    <td className="px-4 py-3 text-center">{s.cantidad_bombas_condensacion}</td>
                    <td className="px-4 py-3">{formatMinutos(s.tiempo_estimado_minutos)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActiva(s)}
                        className={`text-xs px-2 py-1 rounded-full ${
                          s.activa ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {s.activa ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(s)}
                        className="text-sky-600 hover:underline text-sm"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sucursales.length === 0 && (
            <p className="p-8 text-center text-slate-400">No hay sucursales registradas</p>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-slate-800">
                {editing ? 'Editar sucursal' : 'Nueva sucursal'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">
                ×
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la sucursal</label>
                <input
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none"
                  placeholder="Ej: Le Café Centro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                <select
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value as MarcaSucursal })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 outline-none"
                >
                  <option value="le_cafe">Le Café</option>
                  <option value="punta_brasas">Punta Brasas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                <input
                  required
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 outline-none"
                  placeholder="Calle, número, colonia..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
                <input
                  value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mini Split</label>
                  <input
                    type="number"
                    min={0}
                    value={form.cantidad_mini_split}
                    onChange={(e) => setForm({ ...form, cantidad_mini_split: +e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Equipos grandes</label>
                  <input
                    type="number"
                    min={0}
                    value={form.cantidad_equipos_grandes}
                    onChange={(e) => setForm({ ...form, cantidad_equipos_grandes: +e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bombas</label>
                  <input
                    type="number"
                    min={0}
                    value={form.cantidad_bombas_condensacion}
                    onChange={(e) => setForm({ ...form, cantidad_bombas_condensacion: +e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo estimado (min)</label>
                  <input
                    type="number"
                    min={15}
                    value={form.tiempo_estimado_minutos}
                    onChange={(e) => setForm({ ...form, tiempo_estimado_minutos: +e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Orden en ciclo</label>
                  <input
                    type="number"
                    min={0}
                    value={form.orden_ciclo}
                    onChange={(e) => setForm({ ...form, orden_ciclo: +e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-600 disabled:opacity-60"
                >
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

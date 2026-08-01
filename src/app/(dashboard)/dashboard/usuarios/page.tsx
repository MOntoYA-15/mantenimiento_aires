'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Perfil, UserRole } from '@/types/database';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('perfiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsuarios(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const cambiarRol = async (id: string, rol: UserRole) => {
    setSaving(id);
    const { error } = await supabase
      .from('perfiles')
      .update({ rol, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      setMensaje('Error al cambiar el rol: ' + error.message);
    } else {
      setMensaje('Rol actualizado correctamente');
      setUsuarios((prev) =>
        prev.map((u) => (u.id === id ? { ...u, rol } : u))
      );
    }
    setSaving(null);
    setTimeout(() => setMensaje(''), 3000);
  };

  const toggleActivo = async (u: Perfil) => {
    setSaving(u.id);
    const { error } = await supabase
      .from('perfiles')
      .update({ activo: !u.activo, updated_at: new Date().toISOString() })
      .eq('id', u.id);

    if (error) {
      setMensaje('Error: ' + error.message);
    } else {
      setUsuarios((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, activo: !x.activo } : x))
      );
      setMensaje(u.activo ? 'Usuario desactivado' : 'Usuario activado');
    }
    setSaving(null);
    setTimeout(() => setMensaje(''), 3000);
  };

  const rolColor = (rol: string) => {
    if (rol === 'admin') return 'bg-purple-100 text-purple-800';
    if (rol === 'tecnico') return 'bg-sky-100 text-sky-800';
    return 'bg-amber-100 text-amber-800';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Usuarios</h1>
        <p className="text-slate-500 mt-1 text-sm sm:text-base">
          Gestiona roles y acceso de administradores, técnicos y gerentes
        </p>
      </div>

      {mensaje && (
        <div className="bg-sky-50 text-sky-800 px-4 py-3 rounded-xl text-sm">
          {mensaje}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
        <strong>Cómo agregar usuarios nuevos:</strong>
        <ol className="list-decimal ml-4 mt-2 space-y-1">
          <li>La persona se registra desde la pantalla de login (botón &quot;Regístrate&quot;).</li>
          <li>Después de que se registre, aparece aquí automáticamente.</li>
          <li>Tú le cambias el <strong>rol</strong> (admin, técnico o gerente).</li>
        </ol>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : usuarios.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">
          No hay usuarios registrados todavía
        </div>
      ) : (
        <>
          {/* Vista móvil: tarjetas */}
          <div className="space-y-3 md:hidden">
            {usuarios.map((u) => (
              <div key={u.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-800">{u.nombre}</div>
                    <div className="text-xs text-slate-400 break-all">{u.email}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${rolColor(u.rol)}`}>
                    {u.rol}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <select
                    value={u.rol}
                    disabled={saving === u.id}
                    onChange={(e) => cambiarRol(u.id, e.target.value as UserRole)}
                    className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="admin">Admin</option>
                    <option value="tecnico">Técnico</option>
                    <option value="gerente">Gerente</option>
                  </select>
                  <button
                    onClick={() => toggleActivo(u)}
                    disabled={saving === u.id}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                      u.activo
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Vista desktop: tabla */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Correo</th>
                    <th className="px-4 py-3 font-medium">Rol</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Registrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-800">{u.nombre}</td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.rol}
                          disabled={saving === u.id}
                          onChange={(e) => cambiarRol(u.id, e.target.value as UserRole)}
                          className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer ${rolColor(u.rol)}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="tecnico">Técnico</option>
                          <option value="gerente">Gerente</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActivo(u)}
                          disabled={saving === u.id}
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            u.activo
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('es-MX')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

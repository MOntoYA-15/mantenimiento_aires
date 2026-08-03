'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { registrarBitacora } from '@/lib/bitacora';
import type { Perfil, UserRole } from '@/types/database';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [pendientes, setPendientes] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [rolAprobar, setRolAprobar] = useState<Record<string, UserRole>>({});
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('perfiles').select('*').order('created_at', { ascending: false });
    const all = data || [];
    setPendientes(all.filter((u) => !u.aprobado));
    setUsuarios(all.filter((u) => u.aprobado));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const showMsg = (m: string) => {
    setMensaje(m);
    setTimeout(() => setMensaje(''), 3500);
  };

  const aprobar = async (u: Perfil) => {
    const rol = rolAprobar[u.id] || 'tecnico';
    setSaving(u.id);
    const { error } = await supabase
      .from('perfiles')
      .update({ aprobado: true, activo: true, bloqueado: false, rol, updated_at: new Date().toISOString() })
      .eq('id', u.id);
    if (error) showMsg('Error: ' + error.message);
    else {
      await registrarBitacora('aprobar_usuario', 'perfiles', u.id, 'Aprobado como ' + rol + ': ' + u.email);
      showMsg(u.nombre + ' aprobado como ' + rol);
      load();
    }
    setSaving(null);
  };

  const rechazar = async (u: Perfil) => {
    if (!confirm('Rechazar solicitud de ' + u.nombre + '?')) return;
    setSaving(u.id);
    await supabase.from('perfiles').delete().eq('id', u.id);
    await registrarBitacora('rechazar_usuario', 'perfiles', u.id, u.email);
    showMsg('Solicitud rechazada');
    setSaving(null);
    load();
  };

  const cambiarRol = async (id: string, rol: UserRole) => {
    setSaving(id);
    await supabase.from('perfiles').update({ rol, updated_at: new Date().toISOString() }).eq('id', id);
    await registrarBitacora('cambiar_rol', 'perfiles', id, 'Nuevo rol: ' + rol);
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, rol } : u)));
    setSaving(null);
    showMsg('Rol actualizado');
  };

  const toggleBloqueo = async (u: Perfil) => {
    setSaving(u.id);
    const bloqueado = !u.bloqueado;
    await supabase.from('perfiles').update({ bloqueado, activo: !bloqueado, updated_at: new Date().toISOString() }).eq('id', u.id);
    await registrarBitacora(bloqueado ? 'bloquear_usuario' : 'desbloquear_usuario', 'perfiles', u.id, u.email);
    setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, bloqueado, activo: !bloqueado } : x)));
    setSaving(null);
    showMsg(bloqueado ? 'Usuario bloqueado' : 'Usuario desbloqueado');
  };

  const eliminarUsuario = async (u: Perfil) => {
    if (!confirm('Eliminar a ' + u.nombre + '?')) return;
    setSaving(u.id);
    await supabase.from('perfiles').delete().eq('id', u.id);
    await registrarBitacora('eliminar_usuario', 'perfiles', u.id, u.email);
    setSaving(null);
    showMsg('Usuario eliminado');
    load();
  };

  const enviarResetPassword = async (u: Perfil) => {
    setSaving(u.id);
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin + '/login' : undefined,
    });
    if (error) showMsg('Error: ' + error.message);
    else {
      await registrarBitacora('reset_password', 'perfiles', u.id, u.email);
      showMsg('Correo de restablecimiento enviado a ' + u.email);
    }
    setSaving(null);
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
        <p className="text-slate-500 mt-1 text-sm">Aprobaciones, roles, bloqueo y restablecer contraseña</p>
      </div>

      {mensaje && <div className="bg-sky-50 text-sky-800 px-4 py-3 rounded-xl text-sm">{mensaje}</div>}

      {pendientes.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Solicitudes pendientes ({pendientes.length})
          </h2>
          {pendientes.map((u) => (
            <div key={u.id} className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <div className="font-semibold text-slate-800">{u.nombre}</div>
              <div className="text-sm text-slate-500 break-all">{u.email}</div>
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <select
                  value={rolAprobar[u.id] || 'tecnico'}
                  onChange={(e) => setRolAprobar({ ...rolAprobar, [u.id]: e.target.value as UserRole })}
                  className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="tecnico">Técnico</option>
                  <option value="gerente">Gerente</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={() => aprobar(u)} disabled={saving === u.id}
                  className="text-sm px-3 py-1.5 bg-green-500 text-white rounded-lg">Aprobar</button>
                <button onClick={() => rechazar(u)} disabled={saving === u.id}
                  className="text-sm px-3 py-1.5 bg-red-50 text-red-600 rounded-lg">Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-semibold text-slate-800">Usuarios aprobados</h2>
      {loading ? <p className="text-slate-400">Cargando...</p> : usuarios.length === 0 ? (
        <div className="bg-white rounded-2xl border p-8 text-center text-slate-400">No hay usuarios aprobados</div>
      ) : (
        <div className="space-y-3">
          {usuarios.map((u) => (
            <div key={u.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-semibold">{u.nombre}</div>
                  <div className="text-xs text-slate-400 break-all">{u.email}</div>
                </div>
                <span className={'text-xs px-2 py-1 rounded-full h-fit ' + rolColor(u.rol)}>{u.rol}</span>
              </div>
              {u.bloqueado && <span className="text-xs text-red-600 font-medium">Bloqueado</span>}
              <div className="mt-3 flex flex-wrap gap-2">
                <select value={u.rol} disabled={saving === u.id}
                  onChange={(e) => cambiarRol(u.id, e.target.value as UserRole)}
                  className="text-sm px-2 py-1.5 rounded-lg border border-slate-200">
                  <option value="admin">Admin</option>
                  <option value="tecnico">Técnico</option>
                  <option value="gerente">Gerente</option>
                </select>
                <button onClick={() => toggleBloqueo(u)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100">
                  {u.bloqueado ? 'Desbloquear' : 'Bloquear'}
                </button>
                <button onClick={() => enviarResetPassword(u)} className="text-xs px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700">
                  Reset contraseña
                </button>
                <button onClick={() => eliminarUsuario(u)} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

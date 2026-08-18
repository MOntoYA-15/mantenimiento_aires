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
  const [passUser, setPassUser] = useState<Perfil | null>(null);
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
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
    setTimeout(() => setMensaje(''), 4000);
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
    if (!confirm('¿Eliminar a ' + u.nombre + ' (' + u.email + ')?\nSe borrará por completo, aunque sea administrador.')) return;
    setSaving(u.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: u.id,
          adminToken: session?.access_token,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showMsg(json.error || 'No se pudo eliminar');
        setSaving(null);
        return;
      }
      await registrarBitacora('eliminar_usuario', 'perfiles', u.id, u.email);
      showMsg('Usuario eliminado: ' + u.nombre);
      load();
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Error al eliminar');
    }
    setSaving(null);
  };

  const guardarPassword = async () => {
    if (!passUser) return;
    if (newPass.length < 6) {
      showMsg('Mínimo 6 caracteres');
      return;
    }
    if (newPass !== newPass2) {
      showMsg('Las contraseñas no coinciden');
      return;
    }
    setSaving(passUser.id);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: passUser.id,
        newPassword: newPass,
        adminToken: session?.access_token,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      showMsg(json.error || 'Error al cambiar contraseña');
    } else {
      await registrarBitacora('cambiar_password_admin', 'perfiles', passUser.id, passUser.email);
      showMsg('Contraseña actualizada para ' + passUser.nombre);
      setPassUser(null);
      setNewPass('');
      setNewPass2('');
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
        <p className="text-slate-500 mt-1 text-sm">Aprobaciones, roles, bloqueo y cambio de contraseña</p>
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
                <button onClick={() => { setPassUser(u); setNewPass(''); setNewPass2(''); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700">
                  Cambiar contraseña
                </button>
                <button onClick={() => eliminarUsuario(u)} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {passUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 sm:p-6 space-y-4">
            <h3 className="font-semibold text-lg">Cambiar contraseña</h3>
            <p className="text-sm text-slate-500">{passUser.nombre} · {passUser.email}</p>
            <div>
              <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
              <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} minLength={6}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirmar</label>
              <input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} minLength={6}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPassUser(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200">Cancelar</button>
              <button onClick={guardarPassword} disabled={saving === passUser.id}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white font-medium disabled:opacity-60">
                {saving === passUser.id ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

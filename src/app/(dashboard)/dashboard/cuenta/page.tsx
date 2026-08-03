'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { registrarBitacora } from '@/lib/bitacora';
import type { Perfil } from '@/types/database';

export default function CuentaPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
      setPerfil(data);
    }
    load();
  }, []);

  const cambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (password.length < 6) {
      setErr('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== password2) {
      setErr('Las contraseñas no coinciden');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setErr(error.message);
    else {
      await registrarBitacora('cambiar_password_propia', 'perfiles', perfil?.id, 'Usuario cambió su contraseña');
      setMsg('Contraseña actualizada correctamente');
      setPassword('');
      setPassword2('');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Mi cuenta</h1>
        <p className="text-slate-500 mt-1 text-sm">Datos de perfil y cambio de contraseña</p>
      </div>

      {perfil && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-2">
          <div className="text-sm text-slate-500">Nombre</div>
          <div className="font-medium text-slate-800">{perfil.nombre}</div>
          <div className="text-sm text-slate-500 mt-3">Correo</div>
          <div className="font-medium text-slate-800 break-all">{perfil.email}</div>
          <div className="text-sm text-slate-500 mt-3">Rol</div>
          <div className="font-medium text-slate-800 capitalize">{perfil.rol}</div>
        </div>
      )}

      <form onSubmit={cambiarPassword} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-800">Cambiar mi contraseña</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-sky-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            minLength={6}
            required
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-sky-400"
          />
        </div>
        {err && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</div>}
        {msg && <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{msg}</div>}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-600 disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  );
}

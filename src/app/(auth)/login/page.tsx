'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [nombre, setNombre] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nombre, rol: 'tecnico' },
          },
        });
        if (error) throw error;

        // Marcar como no aprobado (por si el trigger no lo hizo)
        if (data.user) {
          await supabase
            .from('perfiles')
            .update({ aprobado: false, activo: false, bloqueado: false })
            .eq('id', data.user.id);
          // Cerrar sesión: no entra hasta que admin apruebe
          await supabase.auth.signOut();
        }

        setSuccessMsg(
          'Solicitud enviada. Un administrador debe aprobar tu cuenta antes de que puedas entrar.'
        );
        setIsRegister(false);
        setNombre('');
        setEmail('');
        setPassword('');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        if (data.user) {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (!perfil) {
            await supabase.auth.signOut();
            throw new Error('Perfil no encontrado. Contacta al administrador.');
          }
          if (perfil.bloqueado) {
            await supabase.auth.signOut();
            throw new Error('Tu cuenta está bloqueada. Contacta al administrador.');
          }
          if (!perfil.aprobado || !perfil.activo) {
            await supabase.auth.signOut();
            throw new Error(
              'Tu cuenta aún no ha sido aprobada por un administrador. Espera la autorización.'
            );
          }
        }

        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al autenticar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-500 text-white text-2xl font-bold shadow-lg shadow-sky-200 mb-4">
            AC
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Mantenimiento de Aires</h1>
          <p className="text-slate-500 mt-1">Le Café & Punta Brasas</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">
            {isRegister ? 'Solicitar acceso' : 'Iniciar sesión'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition"
                  placeholder="Tu nombre"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition"
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
            )}
            {successMsg && (
              <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{successMsg}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold shadow-lg shadow-sky-200 transition disabled:opacity-60"
            >
              {loading ? 'Cargando...' : isRegister ? 'Enviar solicitud' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {isRegister ? '¿Ya tienes cuenta aprobada?' : '¿No tienes cuenta?'}{' '}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
                setSuccessMsg('');
              }}
              className="text-sky-600 font-medium hover:underline"
            >
              {isRegister ? 'Inicia sesión' : 'Solicitar acceso'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

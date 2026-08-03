'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Perfil } from '@/types/database';

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠', roles: ['admin', 'tecnico', 'gerente'] },
  { href: '/dashboard/sucursales', label: 'Sucursales', icon: '📍', roles: ['admin'] },
  { href: '/dashboard/ruta', label: 'Ruta del día', icon: '🗓️', roles: ['admin', 'tecnico'] },
  { href: '/dashboard/problemas', label: 'Problemas', icon: '⚠️', roles: ['admin', 'tecnico', 'gerente'] },
  { href: '/dashboard/emergencias', label: 'Emergencias', icon: '🚨', roles: ['admin', 'tecnico'] },
  { href: '/dashboard/historial', label: 'Historial', icon: '📋', roles: ['admin', 'tecnico'] },
  { href: '/dashboard/usuarios', label: 'Usuarios', icon: '👥', roles: ['admin'] },
  { href: '/dashboard/cuenta', label: 'Mi cuenta', icon: '🔑', roles: ['admin', 'tecnico', 'gerente'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (!data?.aprobado || data?.bloqueado || !data?.activo) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }
      setPerfil(data);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  const filteredNav = navItems.filter((item) =>
    perfil ? item.roles.includes(perfil.rol) : false
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Overlay móvil */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-30
          transition-transform duration-200 ease-in-out
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold text-sm">
              AC
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">Mantenimiento AC</div>
              <div className="text-xs text-slate-400">Le Café · Punta Brasas</div>
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="md:hidden text-slate-400 text-xl p-1"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  active
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-sm">
              {perfil?.nombre?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate">{perfil?.nombre}</div>
              <div className="text-xs text-slate-400 capitalize">{perfil?.rol}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-slate-500 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top bar móvil */}
        <header className="md:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 -ml-1 rounded-lg hover:bg-slate-100 text-slate-600"
            aria-label="Abrir menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="font-semibold text-slate-800 text-sm">Mantenimiento AC</div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

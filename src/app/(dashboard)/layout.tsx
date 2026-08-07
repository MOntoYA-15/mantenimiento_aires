'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Perfil } from '@/types/database';

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: '⌂', roles: ['admin', 'tecnico', 'gerente'] },
  { href: '/dashboard/sucursales', label: 'Sucursales', icon: '◎', roles: ['admin'] },
  { href: '/dashboard/ruta', label: 'Ruta del día', icon: '☰', roles: ['admin', 'tecnico'] },
  { href: '/dashboard/problemas', label: 'Problemas', icon: '!', roles: ['admin', 'tecnico', 'gerente'] },
  { href: '/dashboard/emergencias', label: 'Emergencias', icon: '⚡', roles: ['admin', 'tecnico'] },
  { href: '/dashboard/historial', label: 'Historial', icon: '≡', roles: ['admin', 'tecnico'] },
  { href: '/dashboard/usuarios', label: 'Usuarios', icon: '☺', roles: ['admin'] },
  { href: '/dashboard/cuenta', label: 'Mi cuenta', icon: '⚙', roles: ['admin', 'tecnico', 'gerente'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ac-theme') : null;
    const preferDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(preferDark);
    document.documentElement.classList.toggle('dark', preferDark);
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('ac-theme', next ? 'dark' : 'light');
  };
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
      const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
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
      <div className="min-h-screen flex items-center justify-center app-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 animate-pulse" />
          <div className="text-slate-400 text-sm">Cargando...</div>
        </div>
      </div>
    );
  }

  const filteredNav = navItems.filter((item) =>
    perfil ? item.roles.includes(perfil.rol) : false
  );

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="min-h-screen flex app-bg">
      {menuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-20 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      <aside
        className={`
          w-64 bg-white/90 backdrop-blur-xl border-r border-slate-200/80 flex flex-col fixed h-full z-30
          transition-transform duration-300 ease-out shadow-xl shadow-slate-200/50
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:shadow-none
        `}
      >
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-600 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-sky-200">
              AC
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm tracking-tight">Mantenimiento AC</div>
              <div className="text-[11px] text-slate-400 font-medium">Le Café · Punta Brasas</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {filteredNav.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-sky-200/80'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                  active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                }`}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-sm font-semibold">
              {(perfil?.nombre || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-800 truncate">{perfil?.nombre}</div>
              <div className="text-[11px] text-slate-400 capitalize">{perfil?.rol}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-slate-500 hover:text-red-600 px-2 py-2 rounded-lg hover:bg-red-50 transition"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-64 min-w-0 flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3 md:px-8 shadow-sm">
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm"
          >
            ☰
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {saludo}, <span className="font-semibold text-slate-800">{perfil?.nombre?.split(' ')[0]}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={toggleDark}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-lg shadow-sm"
            title={darkMode ? 'Modo claro' : 'Modo oscuro'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-white/80 dark:bg-slate-800 border border-slate-100 dark:border-slate-600 px-3 py-1.5 rounded-full">
            {new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}

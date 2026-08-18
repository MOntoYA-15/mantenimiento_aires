import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, adminToken } = body as {
      userId?: string;
      adminToken?: string;
    };

    if (!userId || !adminToken) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !serviceKey || !anonKey) {
      return NextResponse.json(
        { error: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel' },
        { status: 500 }
      );
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${adminToken}` } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser(adminToken);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (user.id === userId) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu propia cuenta' },
        { status: 400 }
      );
    }

    const { data: perfilAdmin } = await userClient
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (perfilAdmin?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Quitar referencias que bloquean el borrado (técnicos/gerentes con historial)
    await admin
      .from('visitas_programadas')
      .update({ tecnico_id: null })
      .eq('tecnico_id', userId);

    await admin
      .from('problemas')
      .update({ resuelto_por: null })
      .eq('resuelto_por', userId);

    // reportado_por es NOT NULL → reasignar al admin que elimina
    await admin
      .from('problemas')
      .update({ reportado_por: user.id })
      .eq('reportado_por', userId);

    // bitacora si existe
    try {
      await admin.from('bitacora').update({ usuario_id: null }).eq('usuario_id', userId);
    } catch {
      /* tabla puede no tener esa columna o no existir */
    }

    // 2) Borrar perfil primero (con service role ignora RLS)
    const { error: perfErr } = await admin.from('perfiles').delete().eq('id', userId);
    if (perfErr) {
      return NextResponse.json(
        { error: 'No se pudo borrar el perfil: ' + perfErr.message },
        { status: 400 }
      );
    }

    // 3) Borrar de Auth
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      // Perfil ya borrado; Auth puede fallar si el usuario no existe ahí
      console.warn('Auth delete:', authErr.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

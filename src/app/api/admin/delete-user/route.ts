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

    // Verificar que quien llama es admin
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${adminToken}` } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser(adminToken);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // No puede eliminarse a sí mismo
    if (user.id === userId) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu propia cuenta' },
        { status: 400 }
      );
    }

    const { data: perfil } = await userClient
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (perfil?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Borrar de Auth (cascade borra perfil si hay FK ON DELETE CASCADE)
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      // Si falla auth, intentar borrar solo el perfil
      const { error: perfErr } = await admin.from('perfiles').delete().eq('id', userId);
      if (perfErr) {
        return NextResponse.json(
          { error: authErr.message || perfErr.message },
          { status: 400 }
        );
      }
    } else {
      // Asegurar perfil eliminado
      await admin.from('perfiles').delete().eq('id', userId);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

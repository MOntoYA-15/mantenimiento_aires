import { createClient } from '@/lib/supabase/client';

/** Extrae path del bucket desde una public URL de Supabase Storage */
export function pathFromPublicUrl(url: string): string | null {
  try {
    const marker = '/storage/v1/object/public/archivos/';
    const i = url.indexOf(marker);
    if (i >= 0) return decodeURIComponent(url.slice(i + marker.length));
    const marker2 = '/storage/v1/object/sign/archivos/';
    const j = url.indexOf(marker2);
    if (j >= 0) {
      const rest = url.slice(j + marker2.length);
      return decodeURIComponent(rest.split('?')[0]);
    }
  } catch { /* ignore */ }
  return null;
}

/** Devuelve URL usable (firmada 1h) para ver el archivo */
export async function resolveFileUrl(url: string): Promise<string> {
  if (!url) return url;
  const path = pathFromPublicUrl(url);
  if (!path) return url;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from('archivos').createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch { /* ignore */ }
  return url;
}

export async function resolveFiles<T extends { url: string }>(files: T[]): Promise<(T & { viewUrl: string })[]> {
  return Promise.all(
    files.map(async (f) => ({ ...f, viewUrl: await resolveFileUrl(f.url) }))
  );
}

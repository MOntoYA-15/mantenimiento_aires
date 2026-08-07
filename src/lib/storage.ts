import { createClient } from '@/lib/supabase/client';

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

/** Comprime imagen en el cliente para subir más rápido (máx 1280px, calidad 0.7) */
export async function compressImage(file: File, maxSide = 1280, quality = 0.7): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxSide || height > maxSide) {
      const scale = maxSide / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );
    if (!blob) return file;
    const name = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export async function prepareFilesForUpload(files: File[]): Promise<File[]> {
  return Promise.all(
    files.map(async (f) => (f.type.startsWith('image/') ? compressImage(f) : f))
  );
}

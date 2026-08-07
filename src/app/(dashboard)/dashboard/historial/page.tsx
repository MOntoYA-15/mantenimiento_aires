'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { marcaLabel, estadoVisitaColor } from '@/lib/utils';
import type { VisitaProgramada, Sucursal, ArchivoVisita, Perfil } from '@/types/database';
import { resolveFiles } from '@/lib/storage';

type VisitaFull = VisitaProgramada & {
  sucursal?: Sucursal;
  tecnico?: Perfil;
  archivos?: ArchivoVisita[];
};

export default function HistorialPage() {
  const [visitas, setVisitas] = useState<VisitaFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<VisitaFull | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; tipo: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('visitas_programadas')
        .select('*, sucursal:sucursales(*), tecnico:perfiles(*), archivos:archivos_visita(*)')
        .in('estado', ['completada', 'parcial'])
        .order('created_at', { ascending: false })
        .limit(120);

      const sorted = (data || []).sort((a, b) => {
        const ta = a.fecha_fin || a.created_at || '';
        const tb = b.fecha_fin || b.created_at || '';
        return tb.localeCompare(ta);
      });
      const withFiles = await Promise.all(sorted.map(async (v) => {
        if (v.archivos?.length) {
          const archivos = await resolveFiles(v.archivos);
          return { ...v, archivos: archivos.map(a => ({ ...a, url: a.viewUrl })) };
        }
        return v;
      }));
      setVisitas(withFiles);
      setLoading(false);
    }
    load();
  }, []);

  const formatFecha = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Historial</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Lo más reciente arriba · toca una fila para ver detalle y evidencias
        </p>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : visitas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">
          Aún no hay trabajos registrados
        </div>
      ) : (
        <div className="space-y-3">
          {visitas.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setDetalle(v)}
              className="w-full text-left bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm hover:border-sky-200:border-sky-700 transition"
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-800">{v.sucursal?.nombre || 'Sucursal'}</h3>
                {v.es_emergencia && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    Emergencia P{v.prioridad_emergencia}
                  </span>
                )}
                <span className={'text-xs px-2 py-0.5 rounded-full ' + estadoVisitaColor(v.estado)}>
                  {v.estado}
                </span>
                {(v.archivos?.length || 0) > 0 && (
                  <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                    {v.archivos!.length} archivo(s)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {formatFecha(v.fecha_fin || v.created_at)}
                {v.sucursal && ' · ' + marcaLabel(v.sucursal.marca)}
                {v.tecnico?.nombre && ' · ' + v.tecnico.nombre}
              </p>
              {v.trabajo_realizado && (
                <p className="text-sm text-slate-600 mt-2 line-clamp-2">{v.trabajo_realizado}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white">
              <div>
                <h3 className="font-semibold text-lg text-slate-800">{detalle.sucursal?.nombre}</h3>
                <p className="text-sm text-slate-500">{formatFecha(detalle.fecha_fin || detalle.created_at)}</p>
              </div>
              <button onClick={() => setDetalle(null)} className="text-slate-400 text-2xl p-1">×</button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400">Estado</div>
                  <span className={'text-xs px-2 py-0.5 rounded-full ' + estadoVisitaColor(detalle.estado)}>{detalle.estado}</span>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Técnico</div>
                  <div className="font-medium text-slate-800">{detalle.tecnico?.nombre || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Tipo</div>
                  <div className="font-medium text-slate-800">
                    {detalle.es_emergencia ? 'Emergencia P' + detalle.prioridad_emergencia : 'Preventivo'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Marca</div>
                  <div className="font-medium text-slate-800">
                    {detalle.sucursal && marcaLabel(detalle.sucursal.marca)}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Trabajo realizado</div>
                <div className="bg-slate-50 rounded-xl p-3 text-slate-700 whitespace-pre-wrap">
                  {detalle.trabajo_realizado || 'Sin registro'}
                </div>
              </div>

              {detalle.observaciones && (
                <div>
                  <div className="text-xs text-slate-400 mb-1">Observaciones</div>
                  <div className="bg-slate-50 rounded-xl p-3 text-slate-700 whitespace-pre-wrap">
                    {detalle.observaciones}
                  </div>
                </div>
              )}

              {detalle.estado === 'parcial' && (
                <div className="bg-amber-50 rounded-xl p-3 text-amber-800 text-sm">
                  Pendientes: {detalle.aires_pendientes || 0} aires
                  {(detalle.mini_split_pendientes || 0) > 0 && ' · mini ' + detalle.mini_split_pendientes}
                  {(detalle.equipos_grandes_pendientes || 0) > 0 && ' · grandes ' + detalle.equipos_grandes_pendientes}
                  {(detalle.bombas_pendientes || 0) > 0 && ' · bombas ' + detalle.bombas_pendientes}
                </div>
              )}

              <div>
                <div className="text-xs text-slate-400 mb-2">Evidencias</div>
                {!detalle.archivos || detalle.archivos.length === 0 ? (
                  <p className="text-slate-400 text-sm">No hay fotos ni videos en esta visita</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {detalle.archivos.map((a) =>
                      a.tipo === 'imagen' ? (
                        <button key={a.id} type="button" onClick={() => setLightbox({ url: a.url, tipo: 'imagen' })}
                          className="block w-full">
                          <img src={a.url} alt={a.nombre_archivo || 'Evidencia'}
                            className="w-full h-36 object-cover rounded-xl border border-slate-100" />
                        </button>
                      ) : (
                        <button key={a.id} type="button" onClick={() => setLightbox({ url: a.url, tipo: 'video' })}
                          className="h-36 bg-slate-100 rounded-xl flex flex-col items-center justify-center border gap-1">
                          <span className="text-3xl">🎬</span>
                          <span className="text-xs text-slate-500">Ver video</span>
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              <button onClick={() => setDetalle(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          {lightbox.tipo === 'imagen' ? (
            <img src={lightbox.url} alt="" className="max-w-full max-h-[90vh] rounded-lg object-contain" />
          ) : (
            <video src={lightbox.url} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg" onClick={(e) => e.stopPropagation()} />
          )}
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white text-3xl">×</button>
        </div>
      )}
    </div>
  );
}

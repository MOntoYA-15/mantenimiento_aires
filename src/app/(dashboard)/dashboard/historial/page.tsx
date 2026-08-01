'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatHoras, marcaLabel, estadoVisitaColor } from '@/lib/utils';
import type { VisitaProgramada, Sucursal, ArchivoVisita, Perfil } from '@/types/database';

type VisitaFull = VisitaProgramada & {
  sucursal?: Sucursal;
  tecnico?: Perfil;
  archivos?: ArchivoVisita[];
};

export default function HistorialPage() {
  const [visitas, setVisitas] = useState<VisitaFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<VisitaFull | null>(null);
  const [verEvidencias, setVerEvidencias] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('visitas_programadas')
        .select('*, sucursal:sucursales(*), tecnico:perfiles(*), archivos:archivos_visita(*)')
        .in('estado', ['completada', 'parcial'])
        .order('fecha_programada', { ascending: false })
        .limit(80);
      setVisitas(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Historial de mantenimientos</h1>
        <p className="text-slate-500 mt-1 text-sm">Trabajos completados y parciales · detalle y evidencias</p>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : visitas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-12 text-center text-slate-400">
          Aún no hay visitas completadas
        </div>
      ) : (
        <>
          {/* Móvil */}
          <div className="space-y-3 md:hidden">
            {visitas.map((v) => (
              <div key={v.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-800">{v.sucursal?.nombre}</div>
                    <div className="text-xs text-slate-400">
                      {v.fecha_programada} · {v.sucursal && marcaLabel(v.sucursal.marca)}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${estadoVisitaColor(v.estado)}`}>
                    {v.estado}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-2 line-clamp-2">{v.trabajo_realizado || 'Sin detalle'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => { setDetalle(v); setVerEvidencias(false); }}
                    className="text-xs px-3 py-1.5 bg-sky-50 text-sky-700 rounded-lg"
                  >
                    Ver detalle
                  </button>
                  {(v.archivos?.length || 0) > 0 && (
                    <button
                      onClick={() => { setDetalle(v); setVerEvidencias(true); }}
                      className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg"
                    >
                      Evidencias ({v.archivos!.length})
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Sucursal</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Tiempo</th>
                    <th className="px-4 py-3 font-medium">Técnico</th>
                    <th className="px-4 py-3 font-medium">Trabajo</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visitas.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 whitespace-nowrap">{v.fecha_programada}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{v.sucursal?.nombre}</div>
                        <div className="text-xs text-slate-400">{v.sucursal && marcaLabel(v.sucursal.marca)}</div>
                      </td>
                      <td className="px-4 py-3">
                        {v.es_emergencia ? (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            Emergencia P{v.prioridad_emergencia}
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Preventivo</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${estadoVisitaColor(v.estado)}`}>
                          {v.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatHoras(v.tiempo_real_minutos || 0)}</td>
                      <td className="px-4 py-3 text-slate-600">{v.tecnico?.nombre || '—'}</td>
                      <td className="px-4 py-3 max-w-[180px] truncate text-slate-600">
                        {v.trabajo_realizado || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap space-x-2">
                        <button
                          onClick={() => { setDetalle(v); setVerEvidencias(false); }}
                          className="text-sky-600 hover:underline text-sm"
                        >
                          Detalle
                        </button>
                        {(v.archivos?.length || 0) > 0 && (
                          <button
                            onClick={() => { setDetalle(v); setVerEvidencias(true); }}
                            className="text-slate-600 hover:underline text-sm"
                          >
                            Fotos ({v.archivos!.length})
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal detalle / evidencias */}
      {detalle && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="font-semibold text-lg">
                  {verEvidencias ? 'Evidencias fotográficas' : 'Detalle del trabajo'}
                </h3>
                <p className="text-sm text-slate-500">{detalle.sucursal?.nombre}</p>
              </div>
              <button onClick={() => setDetalle(null)} className="text-slate-400 text-2xl p-1">×</button>
            </div>

            {!verEvidencias ? (
              <div className="p-4 sm:p-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-400">Fecha</div>
                    <div className="font-medium">{detalle.fecha_programada}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Estado</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${estadoVisitaColor(detalle.estado)}`}>
                      {detalle.estado}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Tiempo real</div>
                    <div className="font-medium">{formatHoras(detalle.tiempo_real_minutos || 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Técnico</div>
                    <div className="font-medium">{detalle.tecnico?.nombre || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Tipo</div>
                    <div className="font-medium">
                      {detalle.es_emergencia ? `Emergencia P${detalle.prioridad_emergencia}` : 'Preventivo'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Marca</div>
                    <div className="font-medium">{detalle.sucursal && marcaLabel(detalle.sucursal.marca)}</div>
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
                  <div className="bg-amber-50 rounded-xl p-3 text-amber-800">
                    <div className="font-medium text-sm mb-1">Pendientes</div>
                    <div>Total aires: {detalle.aires_pendientes || 0}</div>
                    {(detalle.mini_split_pendientes || 0) > 0 && (
                      <div>Mini Split: {detalle.mini_split_pendientes}</div>
                    )}
                    {(detalle.equipos_grandes_pendientes || 0) > 0 && (
                      <div>Equipos grandes: {detalle.equipos_grandes_pendientes}</div>
                    )}
                  </div>
                )}

                {(detalle.archivos?.length || 0) > 0 && (
                  <button
                    onClick={() => setVerEvidencias(true)}
                    className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium text-sm"
                  >
                    Ver evidencias ({detalle.archivos!.length})
                  </button>
                )}

                <button onClick={() => setDetalle(null)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600">
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="p-4 sm:p-6 space-y-4">
                <button
                  onClick={() => setVerEvidencias(false)}
                  className="text-sm text-sky-600 hover:underline"
                >
                  ← Volver al detalle
                </button>
                {!detalle.archivos || detalle.archivos.length === 0 ? (
                  <p className="text-slate-400 text-sm">No hay evidencias en esta visita</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {detalle.archivos.map((a) =>
                      a.tipo === 'imagen' ? (
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={a.url}
                            alt={a.nombre_archivo || 'Evidencia'}
                            className="w-full h-36 object-cover rounded-xl border border-slate-100"
                          />
                        </a>
                      ) : (
                        <a
                          key={a.id}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="h-36 bg-slate-100 rounded-xl flex items-center justify-center text-3xl border"
                        >
                          🎬
                        </a>
                      )
                    )}
                  </div>
                )}
                <button onClick={() => setDetalle(null)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600">
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

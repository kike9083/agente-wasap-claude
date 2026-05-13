"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userEmail?: string;
  resourceType: string;
  resourceId?: string;
  detail?: string;
  createdAt: number;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  error?: string;
}

function getActionBadgeColor(action: string): string {
  if (action.includes("delete") || action.includes("remove")) return "bg-red-100 text-red-700";
  if (action.includes("create")) return "bg-green-100 text-green-700";
  if (action.includes("update") || action.includes("change")) return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function parseDetail(detail?: string): React.ReactNode {
  if (!detail) return "—";
  try {
    const parsed = JSON.parse(detail);

    if (parsed.changes) {
      return (
        <div className="space-y-2">
          {Object.entries(parsed.changes).map(([key, change]: [string, any]) => (
            <div key={key} className="border-l-2 border-gray-300 pl-2 text-xs">
              <div className="font-medium text-gray-700">{key}:</div>
              <div className="text-gray-600 mt-1">
                <div>Antes: <code className="bg-red-50 px-1.5 py-0.5 rounded text-red-700">{JSON.stringify(change.before)}</code></div>
                <div>Después: <code className="bg-green-50 px-1.5 py-0.5 rounded text-green-700">{JSON.stringify(change.after)}</code></div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (parsed.before !== undefined && parsed.after !== undefined) {
      return (
        <div className="space-y-1 text-xs">
          <div>Antes: <code className="bg-red-50 px-1.5 py-0.5 rounded text-red-700">{JSON.stringify(parsed.before)}</code></div>
          <div>Después: <code className="bg-green-50 px-1.5 py-0.5 rounded text-green-700">{JSON.stringify(parsed.after)}</code></div>
        </div>
      );
    }

    return <pre className="text-xs overflow-auto max-h-32 bg-gray-100 p-2 rounded">{JSON.stringify(parsed, null, 2)}</pre>;
  } catch {
    return detail;
  }
}

export default function AuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const limit = 50;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/audit-logs?offset=${offset}&limit=${limit}`)
      .then((r) => r.json())
      .then((data: AuditLogsResponse) => {
        if (data.error) throw new Error(data.error);
        setLogs(data.logs);
        setTotal(data.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [offset]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          aria-label="Volver al dashboard"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Registro de Auditoría</h1>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {loading && (
          <p className="text-center text-gray-500 py-12">Cargando registros...</p>
        )}
        {error && (
          <p className="text-center text-rose-600 py-12">{error}</p>
        )}

        {!loading && !error && logs.length === 0 && (
          <p className="text-center text-gray-500 py-12">No hay registros de auditoría</p>
        )}

        {!loading && !error && logs.length > 0 && (
          <>
            {/* Tabla */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Fecha</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Usuario</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Acción</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Recurso</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-gray-900 font-medium text-xs">{log.userId}</span>
                            {log.userEmail && (
                              <span className="text-gray-500 text-xs">{log.userEmail}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{log.resourceType}</span>
                            {log.resourceId && (
                              <span className="text-gray-500 truncate max-w-xs">{log.resourceId}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {log.detail && (
                            <details className="cursor-pointer">
                              <summary className="text-gray-600 text-xs select-none hover:text-gray-900 font-medium">
                                Ver detalles
                              </summary>
                              <div className="mt-2">
                                {parseDetail(log.detail)}
                              </div>
                            </details>
                          )}
                          {!log.detail && <span className="text-gray-400 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Mostrando {offset + 1} a {Math.min(offset + limit, total)} de {total.toLocaleString()} registros
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

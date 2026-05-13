"use client";

import { useEffect, useState } from "react";

interface AuditLog {
  $id: string;
  action: string;
  userId: string;
  userEmail?: string;
  resourceType: string;
  resourceId?: string;
  detail?: string;
  createdAt: number;
}

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    try {
      setLoading(true);
      const res = await fetch("/api/audit-logs");
      const data = await res.json();

      if (data.error) throw new Error(data.error);
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar auditoría");
    } finally {
      setLoading(false);
    }
  }

  const getActionColor = (action: string) => {
    if (action.includes("delete") || action.includes("remove")) return "bg-red-50 text-red-700 border-red-200";
    if (action.includes("create") || action.includes("add")) return "bg-green-50 text-green-700 border-green-200";
    if (action.includes("update") || action.includes("change")) return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-gray-50 text-gray-700 border-gray-200";
  };

  const getActionLabel = (action: string) => {
    return action.split(".").pop()?.replace(/_/g, " ").toUpperCase() || action;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("es-ES");
  };

  const parseDetail = (detail?: string) => {
    if (!detail) return null;
    try {
      return JSON.parse(detail);
    } catch {
      return detail;
    }
  };

  if (loading) return <p className="text-gray-500">Cargando auditoría...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Registro de Auditoría</h3>
        <p className="text-sm text-gray-600 mb-4">
          Historial de todos los cambios realizados en el sistema.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-center text-gray-500">
                    Sin registros de auditoría
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const detail = parseDetail(log.detail);
                  return (
                    <tr key={log.$id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-gray-900">
                            {log.userEmail || log.userId}
                          </span>
                          <span className="text-xs text-gray-500">{log.userId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${getActionColor(
                            log.action
                          )}`}
                        >
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <div>
                          <p className="font-medium">{log.resourceType}</p>
                          {log.resourceId && <p className="text-gray-500">{log.resourceId}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {detail && typeof detail === "object" ? (
                          <div className="space-y-1">
                            {Object.entries(detail).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span> {String(value)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          detail
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

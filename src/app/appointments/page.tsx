"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Customer {
  id: string;
  nombre: string;
  apellido: string;
  telefonoCelular: string;
  platform: string;
}

interface Appointment {
  id: string;
  conversationId: string;
  tipoServicio: string;
  fecha: string;
  hora: string;
  notas: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  googleEventId: string | null;
  created_at: number;
  customer: Customer | null;
}

const STATUS_LABELS: Record<Appointment["status"], string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
};

const STATUS_COLORS: Record<Appointment["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-green-100 text-green-700",
};

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString("es-PA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const url =
        filter === "all"
          ? "/api/appointments"
          : `/api/appointments?status=${filter}`;
      const res = await fetch(url);
      if (res.status === 401) { router.push("/login"); return; }
      if (res.status === 403) { setError("Sin permisos para ver citas."); return; }
      const data = await res.json();
      setAppointments(data.appointments ?? []);
    } catch {
      setError("Error al cargar las citas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function changeStatus(id: string, status: Appointment["status"]) {
    setUpdating(id);
    try {
      await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      await load();
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => router.push("/")}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Citas Agendadas</h1>
          <p className="text-xs text-gray-500">{appointments.length} cita{appointments.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Filtros */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {["all", "pending", "confirmed", "completed", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === s
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s === "all" ? "Todas" : STATUS_LABELS[s as Appointment["status"]]}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Cargando...</div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No hay citas</p>
            <p className="text-sm mt-1">Las citas agendadas por el bot aparecerán aquí.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Teléfono</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Servicio</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Hora</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {appointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {appt.customer
                            ? `${appt.customer.nombre} ${appt.customer.apellido}`
                            : <span className="text-gray-400 italic">Sin nombre</span>}
                        </div>
                        {appt.notas && (
                          <div className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate" title={appt.notas}>
                            {appt.notas}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {appt.customer?.telefonoCelular ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{appt.tipoServicio}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{appt.fecha}</td>
                      <td className="px-4 py-3 text-gray-700 font-mono">{appt.hora}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[appt.status]}`}>
                          {STATUS_LABELS[appt.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {appt.status === "pending" && (
                            <button
                              disabled={updating === appt.id}
                              onClick={() => changeStatus(appt.id, "confirmed")}
                              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 font-medium"
                            >
                              Confirmar
                            </button>
                          )}
                          {(appt.status === "pending" || appt.status === "confirmed") && (
                            <>
                              <button
                                disabled={updating === appt.id}
                                onClick={() => changeStatus(appt.id, "completed")}
                                className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 font-medium"
                              >
                                Completar
                              </button>
                              <button
                                disabled={updating === appt.id}
                                onClick={() => changeStatus(appt.id, "cancelled")}
                                className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 font-medium"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                          {appt.googleEventId && (
                            <span title="Sincronizado con Google Calendar" className="px-2 py-1 text-xs bg-gray-50 text-gray-500 rounded-lg">
                              📅
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Stats {
  totalConversations: number;
  aiConversations: number;
  humanConversations: number;
  totalMessages: number;
  messagesToday: number;
  avgMsgsPerConversation: number;
  escalationRate: number;
  dailyChart: { date: string; label: string; user: number; bot: number }[];
}

function StatCard({
  label,
  value,
  sub,
  color = "emerald",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "emerald" | "amber" | "blue" | "rose";
}) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStats(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const maxBar = stats
    ? Math.max(...stats.dailyChart.map((d) => d.user + d.bot), 1)
    : 1;

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
        <h1 className="text-lg font-semibold text-gray-900">Estadísticas</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <p className="text-center text-gray-500 py-12">Cargando estadísticas...</p>
        )}
        {error && (
          <p className="text-center text-rose-600 py-12">{error}</p>
        )}

        {stats && (
          <>
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Conversaciones"
                value={stats.totalConversations}
                color="blue"
              />
              <StatCard
                label="En modo IA"
                value={stats.aiConversations}
                sub={`${stats.totalConversations > 0 ? Math.round((stats.aiConversations / stats.totalConversations) * 100) : 0}% del total`}
                color="emerald"
              />
              <StatCard
                label="Esperando host"
                value={stats.humanConversations}
                sub={`Tasa de escalación ${stats.escalationRate}%`}
                color="amber"
              />
              <StatCard
                label="Mensajes hoy"
                value={stats.messagesToday}
                sub={`Total: ${stats.totalMessages}`}
                color="rose"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <StatCard
                label="Total de mensajes"
                value={stats.totalMessages.toLocaleString()}
                color="blue"
              />
              <StatCard
                label="Promedio por conversación"
                value={`${stats.avgMsgsPerConversation} msgs`}
                color="emerald"
              />
            </div>

            {/* Gráfico de mensajes últimos 7 días */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Mensajes últimos 7 días
              </h2>
              <div className="flex items-end gap-2 h-32">
                {stats.dailyChart.map((day) => {
                  const total = day.user + day.bot;
                  const userPct = total > 0 ? (day.user / maxBar) * 100 : 0;
                  const botPct = total > 0 ? (day.bot / maxBar) * 100 : 0;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{total || ""}</span>
                      <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: "96px" }}>
                        <div
                          className="w-full bg-emerald-400 rounded-t"
                          style={{ height: `${botPct}%`, minHeight: total ? 2 : 0 }}
                          title={`Bot: ${day.bot}`}
                        />
                        <div
                          className="w-full bg-blue-400 rounded-t"
                          style={{ height: `${userPct}%`, minHeight: total ? 2 : 0 }}
                          title={`Usuarios: ${day.user}`}
                        />
                      </div>
                      <span className="text-xs text-gray-500 text-center leading-tight">
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Leyenda */}
              <div className="flex items-center gap-4 mt-3 justify-center">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="inline-block w-3 h-3 rounded-sm bg-blue-400" />
                  Clientes
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="inline-block w-3 h-3 rounded-sm bg-emerald-400" />
                  Bot
                </span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

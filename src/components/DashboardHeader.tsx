"use client";

interface DashboardHeaderProps {
  phone: string | null;
  onDisconnect: () => Promise<void>;
  loading?: boolean;
}

export function DashboardHeader({
  phone,
  onDisconnect,
  loading = false,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Agente WhatsApp
          </h1>
          {phone && (
            <p className="text-sm text-gray-600">
              Conectado: <span className="font-mono">{phone}</span>
            </p>
          )}
        </div>
        <button
          onClick={onDisconnect}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Desconectando..." : "Desconectar"}
        </button>
      </div>
    </header>
  );
}

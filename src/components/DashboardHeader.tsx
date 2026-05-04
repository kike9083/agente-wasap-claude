"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUserName(data.user.name || data.user.email);
          setUserRole(data.user.role ?? "Usuario");
        }
      })
      .catch(console.error);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

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
        <div className="flex items-center gap-4">
          {userName && (
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{userName}</p>
              <p className="text-xs text-gray-500">{userRole}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/settings")}
              className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100"
            >
              Configuración
            </button>
            <button
              onClick={onDisconnect}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Desconectando..." : "Desconectar WhatsApp"}
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

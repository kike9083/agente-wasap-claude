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
    <header className="border-b border-gray-200 bg-white px-3 py-2 md:px-4 md:py-3">
      <div className="flex items-center justify-between gap-2">
        {/* Título y teléfono */}
        <div className="min-w-0">
          <h1 className="text-base md:text-xl font-semibold text-gray-900 leading-tight">
            Agente WhatsApp
          </h1>
          {phone && (
            <p className="text-xs text-gray-500 font-mono truncate">{phone}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Nombre y rol — visible desde sm */}
          {userName && (
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{userName}</p>
              <p className="text-xs text-gray-500">{userRole}</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="px-2 py-1.5 md:px-4 md:py-2 rounded-lg bg-blue-50 text-blue-700 text-xs md:text-sm font-medium hover:bg-blue-100"
            >
              <span className="hidden md:inline">Configuración</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onDisconnect}
              disabled={loading}
              className="px-2 py-1.5 md:px-4 md:py-2 rounded-lg bg-red-100 text-red-700 text-xs md:text-sm font-medium hover:bg-red-200 disabled:opacity-50"
            >
              <span className="hidden md:inline">{loading ? "Desconectando..." : "Desconectar"}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-2 py-1.5 md:px-4 md:py-2 rounded-lg bg-gray-100 text-gray-600 text-xs md:text-sm font-medium hover:bg-gray-200"
            >
              <span className="hidden md:inline">Cerrar sesión</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

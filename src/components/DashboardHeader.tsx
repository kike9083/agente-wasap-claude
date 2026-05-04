"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface DashboardHeaderProps {
  phone: string | null;
  onDisconnect: () => Promise<void>;
  loading?: boolean;
}

async function registerPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  if (existing) return; // ya suscrito

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
}

export function DashboardHeader({
  phone,
  onDisconnect,
  loading = false,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);

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

    // Registrar push automáticamente si ya hay permiso concedido
    if (typeof window !== "undefined" && Notification.permission === "granted") {
      registerPush().catch(console.error);
      setPushEnabled(true);
    }
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function handleTogglePush() {
    if (pushEnabled) {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushEnabled(false);
    } else {
      await registerPush();
      setPushEnabled(Notification.permission === "granted");
    }
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
            {/* Notificaciones push */}
            {"Notification" in window && (
              <button
                type="button"
                onClick={handleTogglePush}
                title={pushEnabled ? "Desactivar notificaciones" : "Activar notificaciones"}
                className={`px-2 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  pushEnabled
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {pushEnabled ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => router.push("/stats")}
              className="px-2 py-1.5 md:px-4 md:py-2 rounded-lg bg-purple-50 text-purple-700 text-xs md:text-sm font-medium hover:bg-purple-100"
            >
              <span className="hidden md:inline">Estadísticas</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

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

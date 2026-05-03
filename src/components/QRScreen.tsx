"use client";

import { useEffect, useState } from "react";

interface QRScreenProps {
  qrPng?: string;
  status: "disconnected" | "qr" | "connecting" | "connected";
}

export function QRScreen({ qrPng, status }: QRScreenProps) {
  const [timeouts, setTimeouts] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed > 10000 && status === "disconnected") {
        setTimeouts((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const showError = timeouts > 0 && status === "disconnected";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2 text-center">
          Agente WhatsApp
        </h1>
        <p className="text-gray-600 text-center mb-8">
          Conecta tu número de WhatsApp
        </p>

        {status === "qr" && qrPng && (
          <div className="flex flex-col items-center">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-2 w-2 gap-0.5">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></div>
              </div>
            </div>
            <img src={qrPng} alt="QR Code" className="w-80 h-80 mb-4" />
            <p className="text-sm text-gray-600 text-center">
              Escanea este código QR desde tu teléfono
            </p>
          </div>
        )}

        {status === "connecting" && (
          <div className="flex flex-col items-center py-12">
            <div className="mb-4 flex items-center justify-center">
              <div className="relative h-8 w-8">
                <div className="absolute inset-0 rounded-full border-2 border-blue-200"></div>
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin"></div>
              </div>
            </div>
            <p className="text-sm text-gray-600">Conectando...</p>
          </div>
        )}

        {status === "disconnected" && (
          <div className="flex flex-col items-center py-12">
            <div className="mb-4 flex items-center justify-center">
              <div className="relative h-8 w-8">
                <div className="absolute inset-0 rounded-full border-2 border-gray-300"></div>
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gray-500 animate-spin"></div>
              </div>
            </div>
            <p className="text-sm text-gray-600">Aguardando conexión...</p>
          </div>
        )}

        {showError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              No se detectó QR. Verifica que el proceso bot esté corriendo:
            </p>
            <code className="block mt-2 text-xs bg-white p-2 rounded border border-red-100 font-mono text-red-600">
              npm run start:bot
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

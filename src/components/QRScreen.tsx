"use client";

import { useEffect, useState } from "react";

interface QRScreenProps {
  qrPng?: string;
  status: "disconnected" | "qr" | "connecting" | "connected";
  onClose?: () => void;
}

export function QRScreen({ qrPng, status, onClose }: QRScreenProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full relative animate-in fade-in zoom-in duration-300">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Vincular WhatsApp</h2>
          <p className="text-gray-500 mt-1">Escanea el código para activar el agente</p>
        </div>

        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl p-4 border border-gray-100 min-h-[320px]">
          {status === "qr" && qrPng ? (
            <div className="flex flex-col items-center animate-in fade-in duration-500">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 mb-4">
                <img src={qrPng} alt="QR Code" className="w-64 h-64" />
              </div>
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-medium border border-amber-100">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                QR Actualizado
              </div>
            </div>
          ) : status === "connecting" ? (
            <div className="flex flex-col items-center py-12">
              <div className="relative h-12 w-12 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin"></div>
              </div>
              <p className="text-gray-600 font-medium">Conectando...</p>
              <p className="text-xs text-gray-400 mt-1">Validando sesión de WhatsApp</p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-12">
              <div className="relative h-12 w-12 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-gray-100 shadow-inner"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gray-400 animate-spin"></div>
              </div>
              <p className="text-gray-600 font-medium">Aguardando...</p>
              <p className="text-xs text-gray-400 mt-1 text-center max-w-[200px]">
                Iniciando servicio de mensajería
              </p>
            </div>
          )}
        </div>

        {showError && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl animate-in slide-in-from-top-2 duration-300">
            <div className="flex gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-800">No se detectó QR</p>
                <p className="text-xs text-red-600 mt-0.5">Asegúrate de que el proceso bot esté activo:</p>
                <code className="block mt-2 text-[10px] bg-white/50 p-2 rounded border border-red-200 font-mono text-red-700">
                  npm run start:bot
                </code>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-[11px] text-gray-400">
          Versión 2.1 • Conexión cifrada de punto a punto
        </div>
      </div>
    </div>
  );
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.86.27"],
  eslint: { ignoreDuringBuilds: true },
  // El type-check se hace localmente con `npx tsc --noEmit` — aquí no hay RAM suficiente en el contenedor
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "pino",
    "node-appwrite",
    "web-push",
    "openai",
    "telegraf",
    "googleapis",
  ],
};

export default nextConfig;

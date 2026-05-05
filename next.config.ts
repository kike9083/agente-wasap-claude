import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.86.27"],
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "pino",
    "node-appwrite",
    "web-push",
    "openai",
    "telegraf",
  ],
};

export default nextConfig;

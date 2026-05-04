import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.86.27"],
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "pino",
    "node-appwrite",
    "web-push",
  ],
};

export default nextConfig;

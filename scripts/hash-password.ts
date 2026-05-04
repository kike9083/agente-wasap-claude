import crypto from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Uso: npx tsx scripts/hash-password.ts <contraseña>");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(password, salt, 64).toString("hex");
console.log(`\nHash listo para .env.local:\n\nscrypt:${salt}:${hash}\n`);

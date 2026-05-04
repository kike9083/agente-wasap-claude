
import crypto from "node:crypto";

function verifyPassword(plain: string, stored: string): boolean {
  if (stored.startsWith("scrypt:")) {
    const parts = stored.split(":");
    const salt = parts[1];
    const expected = Buffer.from(parts[2], "hex");
    try {
      const derived = crypto.scryptSync(plain, salt, 64);
      return crypto.timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
  return plain === stored;
}

function verifyCredentials(email: string, password: string, dashboardUsers: string): boolean {
  const entries = (dashboardUsers ?? "").split(",");
  return entries.some((entry) => {
    const colon = entry.indexOf(":");
    if (colon < 0) return false;
    const e = entry.slice(0, colon).trim();
    const stored = entry.slice(colon + 1).trim();
    console.log(`Checking: ${e} vs ${email}, stored: ${stored} vs ${password}`);
    return e === email && verifyPassword(password, stored);
  });
}

const dashboardUsers = "admin@jaigerhouse.com:Admin1234!,test@jaigerhouse.com:Test1234!";
console.log("Result for admin@jaigerhouse.com / Admin1234!:", verifyCredentials("admin@jaigerhouse.com", "Admin1234!", dashboardUsers));

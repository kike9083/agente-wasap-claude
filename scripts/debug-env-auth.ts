
import { verifyPassword } from './src/lib/auth'; // Using relative path from root

function verifyCredentials(email: string, password: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  const entries = (process.env.DASHBOARD_USERS ?? "").split(",");
  console.log(`Checking against ${entries.length} users.`);
  return entries.some((entry) => {
    const colon = entry.indexOf(":");
    if (colon < 0) return false;
    const e = entry.slice(0, colon).trim().toLowerCase();
    const stored = entry.slice(colon + 1).trim();
    const match = e === cleanEmail;
    if (match) {
        console.log(`Found email match for ${e}. Verifying password...`);
        const passMatch = verifyPassword(password, stored);
        console.log(`Password match: ${passMatch}`);
        return passMatch;
    }
    return false;
  });
}

// Mocking process.env for the test if needed, but the user should run this in their environment
console.log("Current DASHBOARD_USERS starts with:", process.env.DASHBOARD_USERS?.slice(0, 20), "...");
const testEmail = 'kike@jaigerhouse.com';
const testPass = 'Password123';
console.log(`Testing ${testEmail} : ${testPass}`);
const result = verifyCredentials(testEmail, testPass);
console.log(`Result: ${result}`);

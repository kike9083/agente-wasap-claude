import webpush from "web-push";
import fs from "fs";
import path from "path";

const SUBS_FILE = path.join(process.cwd(), "push-subscriptions.json");

let vapidInitialized = false;
function ensureVapid() {
  if (vapidInitialized) return;
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidInitialized = true;
}

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function readSubs(): PushSubscription[] {
  try {
    return JSON.parse(fs.readFileSync(SUBS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeSubs(subs: PushSubscription[]): void {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

export function saveSubscription(sub: PushSubscription): void {
  const subs = readSubs().filter((s) => s.endpoint !== sub.endpoint);
  subs.push(sub);
  writeSubs(subs);
}

export function removeSubscription(endpoint: string): void {
  writeSubs(readSubs().filter((s) => s.endpoint !== endpoint));
}

export async function sendPushToAll(payload: {
  title: string;
  body: string;
  url?: string;
}): Promise<void> {
  ensureVapid();
  const subs = readSubs();
  if (subs.length === 0) return;

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(sub, JSON.stringify(payload)).catch((err) => {
        // Suscripción expirada o inválida — limpiarla
        if (err.statusCode === 410 || err.statusCode === 404) {
          removeSubscription(sub.endpoint);
        }
        throw err;
      })
    )
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) console.warn(`[push] ${failed}/${subs.length} notificaciones fallaron`);
}

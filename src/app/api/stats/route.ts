import { NextResponse } from "next/server";
import { databases, DATABASE_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "node-appwrite";

export async function GET() {
  try {
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const startOfToday = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);

    const [totalConvs, aiConvs, humanConvs, totalMsgs, todayMsgs, recentMsgs] =
      await Promise.all([
        databases.listDocuments(DATABASE_ID, COLLECTIONS.conversations, [Query.limit(1)]),
        databases.listDocuments(DATABASE_ID, COLLECTIONS.conversations, [
          Query.equal("mode", "AI"),
          Query.limit(1),
        ]),
        databases.listDocuments(DATABASE_ID, COLLECTIONS.conversations, [
          Query.equal("mode", "HUMAN"),
          Query.limit(1),
        ]),
        databases.listDocuments(DATABASE_ID, COLLECTIONS.messages, [Query.limit(1)]),
        databases.listDocuments(DATABASE_ID, COLLECTIONS.messages, [
          Query.greaterThanEqual("createdAt", startOfToday),
          Query.limit(1),
        ]),
        // Mensajes de los últimos 7 días para el gráfico (máx 500)
        databases.listDocuments(DATABASE_ID, COLLECTIONS.messages, [
          Query.greaterThanEqual("createdAt", sevenDaysAgo),
          Query.orderAsc("createdAt"),
          Query.limit(500),
        ]),
      ]);

    // Agrupar mensajes por día (YYYY-MM-DD)
    const byDay: Record<string, { user: number; bot: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = { user: 0, bot: 0 };
    }
    for (const doc of recentMsgs.documents) {
      const key = new Date(doc.createdAt * 1000).toISOString().slice(0, 10);
      if (!byDay[key]) continue;
      if (doc.role === "user") byDay[key].user++;
      else byDay[key].bot++;
    }

    const dailyChart = Object.entries(byDay).map(([date, counts]) => ({
      date,
      label: new Date(date + "T12:00:00Z").toLocaleDateString("es", {
        weekday: "short",
        day: "numeric",
      }),
      ...counts,
    }));

    const totalConversations = totalConvs.total;
    const avgMsgsPerConv =
      totalConversations > 0
        ? Math.round(totalMsgs.total / totalConversations)
        : 0;

    return NextResponse.json({
      totalConversations,
      aiConversations: aiConvs.total,
      humanConversations: humanConvs.total,
      totalMessages: totalMsgs.total,
      messagesToday: todayMsgs.total,
      avgMsgsPerConversation: avgMsgsPerConv,
      escalationRate:
        totalConversations > 0
          ? Math.round((humanConvs.total / totalConversations) * 100)
          : 0,
      dailyChart,
    });
  } catch (err) {
    console.error("[api/stats]", err);
    return NextResponse.json({ error: "Error al cargar estadísticas" }, { status: 500 });
  }
}

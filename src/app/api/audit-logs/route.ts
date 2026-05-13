import { NextResponse } from "next/server";
import { databases, DATABASE_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "node-appwrite";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.audit_logs,
      [Query.orderDesc("createdAt"), Query.offset(offset), Query.limit(limit)]
    );

    return NextResponse.json({
      logs: result.documents.map((doc) => ({
        id: doc.$id,
        action: doc.action,
        userId: doc.userId,
        userEmail: doc.userEmail,
        resourceType: doc.resourceType,
        resourceId: doc.resourceId,
        detail: doc.detail,
        createdAt: doc.createdAt * 1000, // Convertir a milliseconds
      })),
      total: result.total,
    });
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    return NextResponse.json(
      { error: "Error al obtener audit logs" },
      { status: 500 }
    );
  }
}

import { ID, Query } from "node-appwrite";
import { databases, DATABASE_ID, COLLECTIONS, SINGLETON_ID } from "./appwrite";

export type Platform = "whatsapp" | "telegram" | "instagram" | "facebook" | "webchat";

export interface Conversation {
  id: string;
  platform: Platform;
  externalId: string;
  phone: string | null;
  name: string | null;
  mode: "AI" | "HUMAN" | "BANNED";
  last_message_at: number | null;
  last_message_preview: string | null;
  created_at: number;
  tags: string[];
  offtopic_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

export interface ConnectionState {
  status: "disconnected" | "qr" | "connecting" | "connected";
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export interface BotSettings {
  system_prompt: string;
  welcome_message: string;
  human_timeout_hours: number;
  llm_model?: string;
  host_phone?: string;
  escalation_phrases?: string;
  offtopic_phrases?: string;
  offtopic_limit?: number;
}

function docToConversation(doc: any): Conversation {
  let tags: string[] = [];
  try { tags = JSON.parse(doc.tags ?? "[]"); } catch { tags = []; }
  return {
    id: doc.$id,
    platform: (doc.platform ?? "whatsapp") as Platform,
    externalId: doc.externalId ?? doc.phone ?? "",
    phone: doc.phone ?? null,
    name: doc.name ?? null,
    mode: (doc.mode ?? "AI") as "AI" | "HUMAN" | "BANNED",
    last_message_at: doc.lastMessageAt ?? null,
    last_message_preview: doc.lastMessagePreview ?? null,
    created_at: doc.createdAt,
    tags,
    offtopic_count: doc.offtopicCount ?? 0,
  };
}

function docToMessage(doc: any): Message {
  return {
    id: doc.$id,
    conversation_id: doc.conversationId,
    role: doc.role as "user" | "assistant" | "human",
    content: doc.content,
    created_at: doc.createdAt,
  };
}

export async function getOrCreateConversation(
  platform: Platform,
  externalId: string,
  name?: string,
  phone?: string
): Promise<{ conversation: Conversation; isNew: boolean }> {
  const result = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.conversations,
    [
      Query.equal("platform", platform),
      Query.equal("externalId", externalId),
      Query.limit(1),
    ]
  );

  if (result.documents.length > 0) {
    const doc = result.documents[0];
    if (name && name !== doc.name) {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.conversations, doc.$id, { name });
      return { conversation: { ...docToConversation(doc), name }, isNew: false };
    }
    return { conversation: docToConversation(doc), isNew: false };
  }

  const now = Math.floor(Date.now() / 1000);
  const doc = await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.conversations,
    ID.unique(),
    {
      platform,
      externalId,
      phone: phone ?? externalId,
      name: name ?? null,
      mode: "AI",
      createdAt: now,
    }
  );
  return { conversation: docToConversation(doc), isNew: true };
}

export async function getConversationById(
  id: string
): Promise<Conversation | null> {
  try {
    const doc = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.conversations,
      id
    );
    return docToConversation(doc);
  } catch {
    return null;
  }
}

export async function listConversations(platform?: Platform): Promise<Conversation[]> {
  const queries: any[] = [Query.orderDesc("lastMessageAt"), Query.limit(100)];
  if (platform) queries.push(Query.equal("platform", platform));
  const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.conversations, queries);
  return result.documents.map(docToConversation);
}

export async function updateConversationTags(
  id: string,
  tags: string[]
): Promise<void> {
  await databases.updateDocument(
    DATABASE_ID,
    COLLECTIONS.conversations,
    id,
    { tags: JSON.stringify(tags) }
  );
}

/**
 * Devuelve conversaciones en modo HUMANO cuyo último mensaje es anterior a
 * `cutoffTimestamp` (epoch en segundos). Usado por el AI timeout poller.
 */
export async function listStaleHumanConversations(
  cutoffTimestamp: number
): Promise<Conversation[]> {
  const result = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.conversations,
    [
      Query.equal("mode", "HUMAN"),
      Query.lessThan("lastMessageAt", cutoffTimestamp),
      Query.limit(50),
    ]
  );
  return result.documents.map(docToConversation);
}

export async function insertMessage(
  conversationId: string,
  role: "user" | "assistant" | "human",
  content: string
): Promise<Message> {
  const now = Math.floor(Date.now() / 1000);

  const doc = await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.messages,
    ID.unique(),
    { conversationId, role, content, createdAt: now }
  );

  // Actualizar preview en la conversación (no crítico si falla)
  databases
    .updateDocument(DATABASE_ID, COLLECTIONS.conversations, conversationId, {
      lastMessageAt: now,
      lastMessagePreview: content.slice(0, 200),
    })
    .catch(() => {});

  return docToMessage(doc);
}

export async function getMessages(
  conversationId: string,
  limit = 50
): Promise<Message[]> {
  const result = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.messages,
    [
      Query.equal("conversationId", conversationId),
      Query.orderDesc("createdAt"),
      Query.limit(limit),
    ]
  );
  return result.documents.map(docToMessage);
}

export async function getRecentHistory(
  conversationId: string,
  limit = 20
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const result = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.messages,
    [
      Query.equal("conversationId", conversationId),
      Query.orderDesc("createdAt"),
      Query.limit(limit),
    ]
  );
  return result.documents
    .reverse()
    .map((doc) => ({
      role: (doc.role === "human" ? "assistant" : doc.role) as
        | "user"
        | "assistant",
      content: doc.content,
    }));
}

export async function setMode(
  conversationId: string,
  mode: "AI" | "HUMAN" | "BANNED"
): Promise<void> {
  await databases.updateDocument(
    DATABASE_ID,
    COLLECTIONS.conversations,
    conversationId,
    { mode }
  );
}

export async function deleteConversation(id: string): Promise<void> {
  // Borrar mensajes en lotes
  let cursor: string | undefined;
  while (true) {
    const queries: any[] = [
      Query.equal("conversationId", id),
      Query.limit(100),
    ];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const msgs = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.messages,
      queries
    );
    for (const doc of msgs.documents) {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.messages, doc.$id);
    }
    if (msgs.documents.length < 100) break;
    cursor = msgs.documents[msgs.documents.length - 1].$id;
  }

  // Borrar outbox pendiente
  const outbox = await databases.listDocuments(DATABASE_ID, COLLECTIONS.outbox, [
    Query.equal("conversationId", id),
    Query.equal("status", "pending"),
    Query.limit(100),
  ]);
  for (const doc of outbox.documents) {
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.outbox, doc.$id);
  }

  await databases.deleteDocument(DATABASE_ID, COLLECTIONS.conversations, id);
}

export async function getConnectionState(): Promise<ConnectionState> {
  try {
    const doc = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.connection_state,
      SINGLETON_ID
    );
    return {
      status: doc.status as ConnectionState["status"],
      qr_string: doc.qrString ?? null,
      phone: doc.phone ?? null,
      updated_at: doc.updatedAt,
    };
  } catch {
    return {
      status: "disconnected",
      qr_string: null,
      phone: null,
      updated_at: Math.floor(Date.now() / 1000),
    };
  }
}

async function safeUpdate(collection: string, id: string, data: any, createData: any) {
  try {
    await databases.updateDocument(DATABASE_ID, collection, id, data);
  } catch (err: any) {
    if (err.code === 404) {
      try {
        await databases.createDocument(DATABASE_ID, collection, id, createData);
      } catch (createErr: any) {
        if (createErr.code === 409) {
          await databases.updateDocument(DATABASE_ID, collection, id, data);
        } else {
          throw createErr;
        }
      }
    } else {
      throw err;
    }
  }
}

export async function setConnectionState(
  partial: Partial<ConnectionState>
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const data: Record<string, any> = { updatedAt: now };
  if (partial.status !== undefined) data.status = partial.status;
  if ("qr_string" in partial) data.qrString = partial.qr_string ?? null;
  if ("phone" in partial) data.phone = partial.phone ?? null;

  const createData = {
    status: partial.status ?? "disconnected",
    qrString: partial.qr_string ?? null,
    phone: partial.phone ?? null,
    updatedAt: now,
  };

  await safeUpdate(COLLECTIONS.connection_state, SINGLETON_ID, data, createData);
}

export async function enqueueOutbox(
  conversationId: string,
  phone: string,
  content: string
): Promise<void> {
  await databases.createDocument(DATABASE_ID, COLLECTIONS.outbox, ID.unique(), {
    conversationId,
    phone,
    content,
    status: "pending",
    createdAt: Math.floor(Date.now() / 1000),
  });
}

export async function getPendingOutbox(
  platform: Platform = "whatsapp",
  limit = 20
): Promise<Array<{ id: string; conversation_id: string; phone: string; content: string; platform: Platform }>> {
  const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.outbox, [
    Query.equal("status", "pending"),
    Query.equal("platform", platform),
    Query.orderAsc("createdAt"),
    Query.limit(limit),
  ]);
  return result.documents.map((doc) => ({
    id: doc.$id,
    conversation_id: doc.conversationId,
    phone: doc.phone,
    content: doc.content,
    platform: (doc.platform ?? "whatsapp") as Platform,
  }));
}

export async function enqueueOutboxForPlatform(
  conversationId: string,
  externalId: string,
  content: string,
  platform: Platform
): Promise<void> {
  await databases.createDocument(DATABASE_ID, COLLECTIONS.outbox, ID.unique(), {
    conversationId,
    phone: externalId,
    content,
    status: "pending",
    platform,
    createdAt: Math.floor(Date.now() / 1000),
  });
}

export async function markOutboxSent(id: string): Promise<void> {
  await databases.updateDocument(DATABASE_ID, COLLECTIONS.outbox, id, {
    status: "sent",
  });
}

export async function notifyHostViaOutbox(
  platform: string,
  clientName: string,
  lastMsg: string
): Promise<void> {
  const hostPhone = process.env.HOST_PHONE;
  if (!hostPhone) {
    console.warn("[notifyHostViaOutbox] HOST_PHONE no está configurado — notificación omitida");
    return;
  }
  const labels: Record<string, string> = { telegram: "Telegram", webchat: "WebChat", instagram: "Instagram", facebook: "Facebook" };
  const label = labels[platform] ?? platform;
  const { conversation } = await getOrCreateConversation("whatsapp", hostPhone, "Sistema", hostPhone);
  await enqueueOutbox(
    conversation.id,
    hostPhone,
    `[TechPadah] Atencion requerida\n\nCanal: ${label}\nCliente: ${clientName}\nUltimo mensaje: "${lastMsg.slice(0, 200)}"\n\nRevisa el dashboard para responder.`
  );
  console.log(`[notifyHostViaOutbox] Notificación encolada → ${hostPhone} (canal: ${label}, cliente: ${clientName})`);
}

export async function requestRestart(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await safeUpdate(
    COLLECTIONS.restart_flag,
    SINGLETON_ID,
    { requestedAt: now },
    { requestedAt: now }
  );
}

export async function getRestartFlag(): Promise<number | null> {
  try {
    const doc = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.restart_flag,
      SINGLETON_ID
    );
    return doc.requestedAt ?? null;
  } catch {
    return null;
  }
}

export async function clearRestartFlag(): Promise<void> {
  await safeUpdate(
    COLLECTIONS.restart_flag,
    SINGLETON_ID,
    { requestedAt: 0 },
    { requestedAt: 0 }
  );
}
export async function getBotSettings(): Promise<BotSettings | null> {
  try {
    const doc = await databases.getDocument(DATABASE_ID, "bot_settings", SINGLETON_ID);
    return {
      system_prompt: doc.system_prompt || "",
      welcome_message: doc.welcome_message || "",
      human_timeout_hours: doc.human_timeout_hours || 24,
      llm_model: doc.llm_model || "",
      host_phone: doc.host_phone || "",
      escalation_phrases: doc.escalation_phrases || "[]",
      offtopic_phrases: doc.offtopic_phrases || "[]",
      offtopic_limit: doc.offtopic_limit ?? 3,
    };
  } catch {
    return null;
  }
}

export async function updateBotSettings(settings: Partial<BotSettings>): Promise<void> {
  const data: Record<string, any> = {};
  if (settings.system_prompt !== undefined) data.system_prompt = settings.system_prompt;
  if (settings.welcome_message !== undefined) data.welcome_message = settings.welcome_message;
  if (settings.human_timeout_hours !== undefined) data.human_timeout_hours = settings.human_timeout_hours;
  if (settings.llm_model !== undefined) data.llm_model = settings.llm_model;
  if (settings.host_phone !== undefined) data.host_phone = settings.host_phone;
  if (settings.escalation_phrases !== undefined) data.escalation_phrases = settings.escalation_phrases;
  if (settings.offtopic_phrases !== undefined) data.offtopic_phrases = settings.offtopic_phrases;
  if (settings.offtopic_limit !== undefined) data.offtopic_limit = settings.offtopic_limit;

  await databases.updateDocument(DATABASE_ID, "bot_settings", SINGLETON_ID, data);
}

export async function incrementOfftopicCount(conversationId: string): Promise<number> {
  const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.conversations, conversationId);
  const newCount = (doc.offtopicCount ?? 0) + 1;
  await databases.updateDocument(DATABASE_ID, COLLECTIONS.conversations, conversationId, {
    offtopicCount: newCount,
  });
  return newCount;
}

export async function resetOfftopicCount(conversationId: string): Promise<void> {
  await databases.updateDocument(DATABASE_ID, COLLECTIONS.conversations, conversationId, {
    offtopicCount: 0,
  });
}

export interface ChannelSettings {
  platform: Platform;
  system_prompt?: string;
  welcome_message?: string;
  llm_model?: string;
  host_phone?: string;
  escalation_phrases?: string;
  offtopic_phrases?: string;
  offtopic_limit?: number;
}

export async function getChannelSettings(platform: Platform): Promise<ChannelSettings | null> {
  try {
    const doc = await databases.getDocument(DATABASE_ID, "channel_settings", platform);
    return {
      platform: doc.platform as Platform,
      system_prompt: doc.system_prompt ?? "",
      welcome_message: doc.welcome_message ?? "",
      llm_model: doc.llm_model ?? "",
      host_phone: doc.host_phone ?? "",
      escalation_phrases: doc.escalation_phrases ?? "[]",
      offtopic_phrases: doc.offtopic_phrases ?? "[]",
      offtopic_limit: doc.offtopic_limit != null ? doc.offtopic_limit : undefined,
    };
  } catch {
    return null;
  }
}

export async function upsertChannelSettings(
  platform: Platform,
  settings: Partial<Omit<ChannelSettings, "platform">>
): Promise<void> {
  const data: Record<string, any> = {};
  if (settings.system_prompt !== undefined) data.system_prompt = settings.system_prompt;
  if (settings.welcome_message !== undefined) data.welcome_message = settings.welcome_message;
  if (settings.llm_model !== undefined) data.llm_model = settings.llm_model;
  if (settings.host_phone !== undefined) data.host_phone = settings.host_phone;
  if (settings.escalation_phrases !== undefined) data.escalation_phrases = settings.escalation_phrases;
  if (settings.offtopic_phrases !== undefined) data.offtopic_phrases = settings.offtopic_phrases;
  if (settings.offtopic_limit !== undefined) data.offtopic_limit = settings.offtopic_limit;

  try {
    await databases.updateDocument(DATABASE_ID, "channel_settings", platform, data);
  } catch (err: any) {
    if (err?.code === 404) {
      await databases.createDocument(DATABASE_ID, "channel_settings", platform, { platform, ...data });
    } else throw err;
  }
}

export async function searchProducts(query: string): Promise<any[]> {
  try {
    const result = await databases.listDocuments(
      DATABASE_ID,
      "products",
      [Query.limit(200)]
    );
    
    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const queryWords = normalize(query).split(/\s+/).map(w => {
      if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
      if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
      return w;
    }).filter(w => w.length > 2); // ignorar preposiciones cortas
    
    if (queryWords.length === 0) return [];

    const scoredProducts = result.documents.map(doc => {
      const docName = normalize(doc.name);
      let score = 0;
      queryWords.forEach(word => {
        if (docName.includes(word)) score++;
      });
      return { doc, score };
    }).filter(p => p.score > 0);

    // Ordenar por mayor cantidad de palabras coincidentes
    scoredProducts.sort((a, b) => b.score - a.score);

    return scoredProducts.map(p => p.doc);
  } catch (err) {
    console.error("Error buscando productos:", err);
    return [];
  }
}

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "messages.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Schema
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
    last_message_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv
    ON messages(conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS connection_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT CHECK(status IN ('disconnected','qr','connecting','connected'))
      NOT NULL DEFAULT 'disconnected',
    qr_string TEXT,
    phone TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  INSERT OR IGNORE INTO connection_state (id, status) VALUES (1, 'disconnected');

  CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    content TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox(sent, created_at);
`);

export interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  created_at: number;
  last_message_preview?: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

export interface ConnectionState {
  id: 1;
  status: "disconnected" | "qr" | "connecting" | "connected";
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export function getOrCreateConversation(
  phone: string,
  name?: string
): Conversation {
  const existing = db
    .prepare("SELECT * FROM conversations WHERE phone = ?")
    .get(phone) as Conversation | undefined;

  if (existing) {
    return existing;
  }

  const stmt = db.prepare(
    `INSERT INTO conversations (phone, name, mode, created_at)
     VALUES (?, ?, 'AI', unixepoch())`
  );
  stmt.run(phone, name || null);

  return db
    .prepare("SELECT * FROM conversations WHERE phone = ?")
    .get(phone) as Conversation;
}

export function getConversationById(id: number): Conversation | null {
  return (
    (db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as
      | Conversation
      | undefined) || null
  );
}

export function insertMessage(
  conversationId: number,
  role: "user" | "assistant" | "human",
  content: string
): Message {
  db.exec(`BEGIN TRANSACTION;`);
  const insertStmt = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, created_at)
     VALUES (?, ?, ?, unixepoch())`
  );
  insertStmt.run(conversationId, role, content);

  const updateStmt = db.prepare(
    `UPDATE conversations SET last_message_at = unixepoch() WHERE id = ?`
  );
  updateStmt.run(conversationId);

  db.exec(`COMMIT;`);

  return db
    .prepare(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(conversationId) as Message;
}

export function getMessages(conversationId: number, limit = 50): Message[] {
  return db
    .prepare(
      `SELECT * FROM messages WHERE conversation_id = ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(conversationId, limit) as Message[];
}

export function getRecentHistory(
  conversationId: number,
  limit = 20
): Array<{ role: "user" | "assistant"; content: string }> {
  const messages = db
    .prepare(
      `SELECT role, content FROM messages WHERE conversation_id = ?
       ORDER BY created_at ASC LIMIT ?`
    )
    .all(conversationId, limit) as Array<{
    role: "user" | "assistant" | "human";
    content: string;
  }>;

  return messages.map((m) => ({
    role: m.role === "human" ? "assistant" : m.role,
    content: m.content,
  }));
}

export function setMode(
  conversationId: number,
  mode: "AI" | "HUMAN"
): void {
  db.prepare("UPDATE conversations SET mode = ? WHERE id = ?").run(
    mode,
    conversationId
  );
}

export function listConversations(): Conversation[] {
  return db
    .prepare(
      `SELECT c.*,
        (SELECT content FROM messages WHERE conversation_id = c.id
         ORDER BY created_at DESC LIMIT 1) as last_message_preview
       FROM conversations c
       ORDER BY c.last_message_at DESC NULLS LAST`
    )
    .all() as Conversation[];
}

export function getConnectionState(): ConnectionState {
  const state = db
    .prepare("SELECT * FROM connection_state WHERE id = 1")
    .get() as ConnectionState | undefined;

  return (
    state || {
      id: 1,
      status: "disconnected",
      qr_string: null,
      phone: null,
      updated_at: Math.floor(Date.now() / 1000),
    }
  );
}

export function setConnectionState(partial: Partial<ConnectionState>): void {
  const current = getConnectionState();
  const updated: ConnectionState = {
    id: 1,
    status: partial.status ?? current.status,
    qr_string:
      partial.qr_string === null ? null : partial.qr_string ?? current.qr_string,
    phone: partial.phone === null ? null : partial.phone ?? current.phone,
    updated_at: Math.floor(Date.now() / 1000),
  };

  db.prepare(
    `INSERT INTO connection_state (id, status, qr_string, phone, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       qr_string = excluded.qr_string,
       phone = excluded.phone,
       updated_at = excluded.updated_at`
  ).run(
    updated.id,
    updated.status,
    updated.qr_string,
    updated.phone,
    updated.updated_at
  );
}

export function enqueueOutbox(
  conversationId: number,
  phone: string,
  content: string
): void {
  db.prepare(
    `INSERT INTO outbox (conversation_id, phone, content, sent, created_at)
     VALUES (?, ?, ?, 0, unixepoch())`
  ).run(conversationId, phone, content);
}

export function getPendingOutbox(limit = 20): Array<{
  id: number;
  conversation_id: number;
  phone: string;
  content: string;
  created_at: number;
}> {
  return db
    .prepare(
      `SELECT id, conversation_id, phone, content, created_at FROM outbox
       WHERE sent = 0 ORDER BY created_at ASC LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    conversation_id: number;
    phone: string;
    content: string;
    created_at: number;
  }>;
}

export function markOutboxSent(id: number): void {
  db.prepare("UPDATE outbox SET sent = 1 WHERE id = ?").run(id);
}

export function deleteConversation(id: number): void {
  db.exec(`BEGIN TRANSACTION;`);
  try {
    db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
    db.prepare("DELETE FROM outbox WHERE conversation_id = ? AND sent = 0").run(
      id
    );
    db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
    db.exec(`COMMIT;`);
  } catch (err) {
    db.exec(`ROLLBACK;`);
    throw err;
  }
}

export { db };

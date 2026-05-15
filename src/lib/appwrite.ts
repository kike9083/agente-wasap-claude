import { Client, Databases, Storage } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

export const databases = new Databases(client);
export const storage = new Storage(client);
export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;
export const BUCKET_ID = "media";

// IDs de colecciones
export const COLLECTIONS = {
  conversations: "conversations",
  messages: "messages",
  connection_state: "connection_state",
  outbox: "outbox",
  restart_flag: "restart_flag",
  audit_logs: "audit_logs",
  customers: "customers",
  appointments: "appointments",
} as const;

// ID fijo para documentos singleton
export const SINGLETON_ID = "singleton";

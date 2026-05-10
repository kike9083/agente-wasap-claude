# Plan: Blacklist de Contactos (Implementación Futura)

## Contexto

El sistema actual usa **BANNED mode** (campo `mode = "BANNED"` en la conversación).
Bloquea por conversación, no por identidad. Si el mismo número abre una nueva
conversación (edge case raro), o si el hater usa otro canal, el bloqueo no aplica.

Este plan describe cómo migrar a un blacklist centralizado cuando sea necesario.

---

## Cuándo implementar esto

- Cuando un mismo número molesta desde múltiples canales (WA + TG + WebChat)
- Cuando se necesita bloqueo preventivo (antes del primer contacto)
- Cuando se necesita auditoría: quién bloqueó, cuándo y por qué
- Cuando el equipo crece y varios agentes necesitan ver la lista de bloqueados

---

## Diseño

### Nueva colección Appwrite: `blacklist`

| Campo        | Tipo    | Descripción                                     |
|--------------|---------|-------------------------------------------------|
| `externalId` | string  | Teléfono o ID de plataforma (+50761142198, etc) |
| `platform`   | string  | "all" o una plataforma específica               |
| `reason`     | string  | Motivo del bloqueo (visible en dashboard)       |
| `blocked_by` | string  | Nombre del operador que bloqueó                 |
| `blocked_at` | integer | Epoch en segundos                               |

Índice requerido: `externalId` + `platform` (para búsqueda rápida).

### Flujo de bloqueo

```
mensaje entrante
      │
      ▼
isBlacklisted(externalId, platform)?
      │ sí → descartar silenciosamente (no responder, no guardar)
      │ no → procesar normalmente
      ▼
message-processor.ts (flujo actual)
```

### Diferencia clave vs BANNED mode

| BANNED mode (actual)     | Blacklist (futuro)                         |
|--------------------------|--------------------------------------------|
| Por conversación         | Por número/ID en todos los canales         |
| Se pierde si se borra la convo | Persiste independiente             |
| Sin metadata             | reason + blocked_by + blocked_at           |
| Sin bloqueo preventivo   | Puedes añadir antes del primer contacto    |

---

## Archivos a crear/modificar

### 1. `scripts/migrate-blacklist.ts`
```typescript
// Crear colección blacklist en Appwrite
await databases.createCollection(DATABASE_ID, ID.unique(), "blacklist");
await databases.createStringAttribute(DATABASE_ID, "blacklist", "externalId", 100, true);
await databases.createStringAttribute(DATABASE_ID, "blacklist", "platform", 20, true, "all");
await databases.createStringAttribute(DATABASE_ID, "blacklist", "reason", 500, false);
await databases.createStringAttribute(DATABASE_ID, "blacklist", "blocked_by", 100, false);
await databases.createIntegerAttribute(DATABASE_ID, "blacklist", "blocked_at", true);
// Crear índice para búsqueda rápida
await databases.createIndex(DATABASE_ID, "blacklist", "by_external_platform",
  "key", ["externalId", "platform"]);
```

### 2. `src/lib/db.ts` — añadir funciones

```typescript
export async function isBlacklisted(externalId: string, platform: Platform): Promise<boolean> {
  const result = await databases.listDocuments(DATABASE_ID, "blacklist", [
    Query.or([
      Query.and([Query.equal("externalId", externalId), Query.equal("platform", platform)]),
      Query.and([Query.equal("externalId", externalId), Query.equal("platform", "all")]),
    ]),
    Query.limit(1),
  ]);
  return result.total > 0;
}

export async function addToBlacklist(
  externalId: string,
  platform: Platform | "all",
  reason: string,
  blocked_by: string
): Promise<void> {
  await databases.createDocument(DATABASE_ID, "blacklist", ID.unique(), {
    externalId, platform, reason, blocked_by,
    blocked_at: Math.floor(Date.now() / 1000),
  });
}

export async function removeFromBlacklist(externalId: string, platform: string): Promise<void> {
  const result = await databases.listDocuments(DATABASE_ID, "blacklist", [
    Query.equal("externalId", externalId),
    Query.equal("platform", platform),
  ]);
  for (const doc of result.documents) {
    await databases.deleteDocument(DATABASE_ID, "blacklist", doc.$id);
  }
}
```

### 3. `src/lib/baileys/handler.ts` — check al inicio

```typescript
const { isBlacklisted } = await import("../db");
// ...al inicio del loop de mensajes, antes de getOrCreateConversation:
if (await isBlacklisted(phone, "whatsapp")) continue;
```

### 4. `src/lib/telegram/handler.ts` y `src/app/api/chat/route.ts`
Mismo pattern: `if (await isBlacklisted(externalId, platform)) return;`

### 5. Dashboard — página `/blacklist`
- Tabla con todos los bloqueados
- Botón "Desbloquear" por fila
- Formulario para añadir manualmente (número + motivo)
- En `ConversationPanel`: cambiar botón "Bloquear" para llamar a `addToBlacklist`
  en lugar de `setMode("BANNED")`

---

## Migración desde BANNED mode

Al activar el blacklist, correr un script que:
1. Busca todas las conversaciones con `mode = "BANNED"`
2. Para cada una, llama `addToBlacklist(externalId, platform, "migrado desde BANNED", "sistema")`
3. Opcionalmente resetea el mode a "HUMAN" en esas conversaciones

---

## Estimación de esfuerzo

| Tarea                        | Tiempo estimado |
|------------------------------|-----------------|
| Script de migración Appwrite | 30 min          |
| Funciones en db.ts           | 30 min          |
| Check en los 3 handlers      | 20 min          |
| Página /blacklist en dashboard | 2-3 horas     |
| Migración de datos existentes | 15 min         |
| **Total**                    | **~4 horas**    |

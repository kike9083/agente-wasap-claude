# MISIÓN: Desplegar instancia nueva del agente omnicanal WhatsApp/Telegram/WebChat

## Contexto del proyecto

Estás desplegando una nueva instancia del agente omnicanal de IA para un nuevo cliente.
El codebase ya existe en GitHub: https://github.com/kike9083/agente-wasap-claude (rama: feature/omnichannel).
NO modifiques el código del repositorio — solo configura el nuevo entorno.

El stack es: Next.js 15 + Baileys (WhatsApp) + Telegraf (Telegram) + Appwrite 1.8 + OpenRouter (LLM) + Groq (transcripción de voz).

---

## Credenciales Appwrite del nuevo cliente

Estas credenciales ya existen — el proyecto fue creado en la consola de Appwrite.
Solo falta crear las colecciones dentro de él.

- APPWRITE_ENDPOINT=https://varios-appwrite-techpadah.fjueze.easypanel.host/v1
- APPWRITE_PROJECT_ID=6a040428000ab137f00f
- APPWRITE_API_KEY=standard_68fa89f91b780bcf0e39e89122036d38c04663d2f6300b1c31124a968f4d282fbe719f1335b01a1c7c411ae8cb3251392b6956f456d08ebdb9766e371fcd460dc62912a8330248be000d8787295bbc113077b48a8c49b67ec9d55276272d49e7c7619be294d19e2fa94f545ada2000e89de91b7c50172b94d2286e09bd1747f5

El DATABASE_ID lo obtendrás después de crear la base de datos en el paso 1.

---

## FASE 1 — Crear base de datos y colecciones en Appwrite

Lee la skill: E:\Documents\aplicaciones\skills\APPWRITE\SKILL.md
Lee también: E:\Documents\aplicaciones\skills\whatsapp-bot-builder-v3\references\appwrite-setup.md

### 1.1 Crear la base de datos

En la consola de Appwrite (https://varios-appwrite-techpadah.fjueze.easypanel.host/console):
- Entra al proyecto con ID 6a040428000ab137f00f
- Ve a Databases → Create Database
- Nombre sugerido: "agente-omnicanal" (el ID que genere Appwrite será tu APPWRITE_DATABASE_ID)
- Copia el Database ID generado — lo necesitarás para el paso 1.2

### 1.2 Crear las colecciones con el script

En el proyecto local (clonar el repo si no está disponible):

```bash
git clone https://github.com/kike9083/agente-wasap-claude
cd agente-wasap-claude
git checkout feature/omnichannel
```

Crea un archivo `.env.local` temporal con:
```
APPWRITE_ENDPOINT=https://varios-appwrite-techpadah.fjueze.easypanel.host/v1
APPWRITE_PROJECT_ID=6a040428000ab137f00f
APPWRITE_API_KEY=standard_68fa89f91b780bcf0e39e89122036d38c04663d2f6300b1c31124a968f4d282fbe719f1335b01a1c7c411ae8cb3251392b6956f456d08ebdb9766e371fcd460dc62912a8330248be000d8787295bbc113077b48a8c49b67ec9d55276272d49e7c7619be294d19e2fa94f545ada2000e89de91b7c50172b94d2286e09bd1747f5
APPWRITE_DATABASE_ID=<ID obtenido en 1.1>
```

Ejecutar:
```bash
npm install --legacy-peer-deps
npx tsx scripts/setup-appwrite.ts
```

Este script crea las 7 colecciones requeridas:
- conversations (platform+externalId, mode AI/HUMAN/BANNED, offtopicCount)
- messages (historial)
- connection_state (singleton Baileys)
- outbox (cola FIFO dashboard→bot)
- restart_flag (IPC reinicio)
- bot_settings (singleton: system_prompt, escalation_phrases, modelo LLM, etc.)
- channel_settings (config por canal: whatsapp, telegram, webchat)

CRITICO (Appwrite 1.8.x):
- Atributos con `default` deben usar `required: false` — es una limitación de Appwrite 1.8
- El script ya tiene esto correcto — no lo modifiques

Luego ejecutar el script de migración para escalación round-robin:
```bash
npx tsx scripts/migrate-escalation-agents.ts
```

Este script agrega 2 atributos al singleton `bot_settings`:
- `escalation_agents` — String(2000), optional — JSON array de números de agentes: `'["50762123","50698765"]'`
- `escalation_agent_index` — Integer, optional, default 0 — índice del siguiente agente en turno

Sin estos atributos, la sección "Agentes de Escalación" del dashboard no funcionará.

### 1.3 Crear el bucket de Storage

En la consola de Appwrite → Storage → Create Bucket:
- Bucket ID: `media`
- Name: Media
- File security: enabled
- Maximum file size: 10MB

### 1.4 Crear usuario administrador

En la consola: Authentication → Users → Create User
- Email: [email del cliente]
- Password: [contraseña segura]
- Labels: admin (para acceder al selector de modelo LLM en el dashboard)

---

## FASE 2 — Preparar variables de entorno del nuevo cliente

Necesitarás obtener del cliente:
- Número de WhatsApp del host (sin +, sin espacios): HOST_PHONE
- Token del bot de Telegram (opcional, de @BotFather): TELEGRAM_BOT_TOKEN
- Canales contratados: ENABLED_CHANNELS

Obtener del proveedor:
- OPENROUTER_API_KEY (https://openrouter.ai)
- GROQ_API_KEY (https://console.groq.com) — **opcional** para transcripción de voz en WhatsApp y Telegram. Sin esta key el bot arranca normalmente, pero los mensajes de audio son ignorados silenciosamente en lugar de transcribirse.

Generar claves VAPID (notificaciones push):
```bash
npx web-push generate-vapid-keys
```

Armar el bloque completo de variables (para usarlo en Fase 3):
```
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=ibm-granite/granite-4.1-8b
HOST_PHONE=507XXXXXXXX

APPWRITE_ENDPOINT=https://varios-appwrite-techpadah.fjueze.easypanel.host/v1
APPWRITE_PROJECT_ID=6a040428000ab137f00f
APPWRITE_API_KEY=standard_68fa89f91b780bcf0e39e89122036d38c04663d2f6300b1c31124a968f4d282fbe719f1335b01a1c7c411ae8cb3251392b6956f456d08ebdb9766e371fcd460dc62912a8330248be000d8787295bbc113077b48a8c49b67ec9d55276272d49e7c7619be294d19e2fa94f545ada2000e89de91b7c50172b94d2286e09bd1747f5
APPWRITE_DATABASE_ID=<ID de la BD creada>

GROQ_API_KEY=gsk_...                  # OPCIONAL — sin esta key los audios se ignoran, el bot funciona igual

TELEGRAM_BOT_TOKEN=NNNNNN:XXXXXXX    # omitir si el plan no incluye Telegram

ENABLED_CHANNELS=whatsapp,webchat    # ajustar según plan contratado
# Valores posibles: whatsapp | whatsapp,telegram | whatsapp,webchat | whatsapp,telegram,webchat

DASHBOARD_URL=https://varios-agente-[nombre-cliente].fjueze.easypanel.host
# IMPORTANTE: este valor se incluye en las notificaciones de escalación que reciben los agentes
# para que puedan entrar al dashboard directamente desde WhatsApp. Usar la URL real del servicio.

NEXT_PUBLIC_VAPID_PUBLIC_KEY=BF...
VAPID_PRIVATE_KEY=8Y...
VAPID_EMAIL=mailto:admin@dominio.com

HUMAN_TIMEOUT_HOURS=1
```

---

## FASE 3 — Crear el servicio en EasyPanel y conectar el repositorio

Lee la skill: E:\Documents\aplicaciones\skills\easypanel-deploy-from-github\SKILL.md

EasyPanel panel: https://fjueze.easypanel.host
La API Key de EasyPanel está guardada en memoria del proyecto — consultarla si es necesario.

### 3.1 Crear el servicio via API tRPC

```bash
# Variables de contexto
PANEL="https://fjueze.easypanel.host"
KEY="<API_KEY de EasyPanel>"
PROJECT="varios"
SERVICE="agente-[nombre-cliente]"   # ej: agente-wasap-cliente2

# Crear servicio
curl -X POST "$PANEL/api/trpc/services.app.createService" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"json\":{\"projectName\":\"$PROJECT\",\"name\":\"$SERVICE\",\"source\":{\"type\":\"github\"}}}"

# Conectar repositorio GitHub
curl -X POST "$PANEL/api/trpc/services.app.updateSourceGithub" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"json\":{\"projectName\":\"$PROJECT\",\"serviceName\":\"$SERVICE\",\"owner\":\"kike9083\",\"repo\":\"agente-wasap-claude\",\"branch\":\"feature/omnichannel\",\"autoDeploy\":false}}"

# Configurar build con Dockerfile
# CRITICO: type y file van dentro del sub-objeto "build" — a nivel raiz son ignorados silenciosamente
curl -X POST "$PANEL/api/trpc/services.app.updateBuild" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"json\":{\"projectName\":\"$PROJECT\",\"serviceName\":\"$SERVICE\",\"build\":{\"type\":\"dockerfile\",\"file\":\"Dockerfile\"}}}"

# CRITICO para Telegram — zeroDowntime DEBE ser false
# Con true: el contenedor viejo sigue corriendo durante el deploy → dos instancias hacen polling
# → Telegram devuelve 409 Conflict → crash loop infinito
curl -X POST "$PANEL/api/trpc/services.app.updateDeploy" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"json\":{\"projectName\":\"$PROJECT\",\"serviceName\":\"$SERVICE\",\"deploy\":{\"replicas\":1,\"command\":null,\"zeroDowntime\":false}}}"
```

### 3.2 Cargar variables de entorno

```bash
curl -X POST "$PANEL/api/trpc/services.app.updateEnv" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "json": {
      "projectName": "varios",
      "serviceName": "<SERVICE>",
      "env": "OPENROUTER_API_KEY=sk-or-v1-...\nOPENROUTER_MODEL=ibm-granite/granite-4.1-8b\nHOST_PHONE=507...\nAPPWRITE_ENDPOINT=https://varios-appwrite-techpadah.fjueze.easypanel.host/v1\nAPPWRITE_PROJECT_ID=6a040428000ab137f00f\nAPPWRITE_API_KEY=standard_68fa...\nAPPWRITE_DATABASE_ID=...\nGROQ_API_KEY=gsk_...\nDASHBOARD_URL=https://varios-agente-CLIENTE.fjueze.easypanel.host\nENABLED_CHANNELS=whatsapp,webchat\nNEXT_PUBLIC_VAPID_PUBLIC_KEY=BF...\nVAPID_PRIVATE_KEY=8Y...\nVAPID_EMAIL=mailto:admin@dominio.com\nHUMAN_TIMEOUT_HOURS=1\n"
    }
  }'
```

### 3.3 Crear dominio

```bash
DOMAIN="varios-${SERVICE}.fjueze.easypanel.host"

curl -X POST "$PANEL/api/trpc/domains.createDomain" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"json\":{\"id\":\"$(date +%s)\",\"host\":\"$DOMAIN\",\"https\":true,\"path\":\"/\",\"middlewares\":[],\"certificateResolver\":\"\",\"wildcard\":false,\"destinationType\":\"service\",\"serviceDestination\":{\"projectName\":\"$PROJECT\",\"serviceName\":\"$SERVICE\",\"port\":3000,\"protocol\":\"http\"}}}"
```

### 3.4 Configurar volumen para sesión de WhatsApp (SOLO via UI — no hay API)

IMPORTANTE: Los volúmenes NO se pueden crear via API — `updateDeploy` acepta `mounts` pero los ignora.
Hacer esto desde la UI de EasyPanel ANTES del primer deploy:

EasyPanel → proyecto `varios` → servicio `$SERVICE` → pestaña Storage → Add Volume:
- Source: `whatsapp-auth`
- Mount path: `/app/auth`

Sin este volumen, la sesión de WhatsApp se pierde cada vez que el contenedor se reinicia.

---

## FASE 4 — Deploy

Lee la skill: E:\Documents\aplicaciones\skills\easypanel-omnichannel-deploy\references\env-vars.md

```bash
# Lanzar el primer deploy
curl -X POST "$PANEL/api/trpc/services.app.deployService" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"json\":{\"projectName\":\"$PROJECT\",\"serviceName\":\"$SERVICE\"}}"
```

Monitorea el progreso en EasyPanel UI → Deployments.
El build de Docker tarda ~3-5 minutos. Espera hasta ver "Running" en el status del servicio.

Verifica que el deploy fue exitoso:
```bash
curl -I "https://$DOMAIN/"                       # debe retornar 307 → /login
curl -I "https://$DOMAIN/login"                  # debe retornar 200
curl "https://$DOMAIN/api/connection/status"     # debe retornar JSON con status
```

---

## FASE 5 — Post-deploy: configurar el bot para el cliente

### 5.1 Conectar WhatsApp (escanear QR)

1. Ve a `https://$DOMAIN/login` — inicia sesión con el usuario creado en Fase 1.4
2. Ve al dashboard → panel de estado de WhatsApp
3. Haz clic en "Conectar" o "Ver QR"
4. Escanea el código QR con el WhatsApp del número del cliente
5. Espera a que aparezca "Conectado" con el número

Si aparece bucle 401 (bloqueo de IP del servidor): ver referencia en
E:\Documents\aplicaciones\skills\easypanel-omnichannel-deploy\references\reconnect-manual.md

### 5.2 Configurar agentes de escalación (Round-Robin)

Si el cliente requiere distribuir las notificaciones de escalación entre varios operadores:

1. Entra al dashboard → Settings → Global (requiere rol admin)
2. Desplázate a la sección **"Agentes de Escalación (Round-Robin)"**
3. Agrega los números de WhatsApp de cada agente (máximo 5), uno por uno
4. Haz clic en Guardar

**Comportamiento:**
- 1ª escalación → Agente 1, 2ª → Agente 2, 3ª → Agente 3, 4ª → Agente 1 (ciclo)
- Si no hay agentes configurados → notificación va a `HOST_PHONE` como antes
- El índice persiste en Appwrite, sobrevive reinicios del servidor

**Formato del mensaje que reciben los agentes:**
```
[TechPadah] Atencion requerida

Canal: WhatsApp
Cliente: Nombre / Numero: +507XXXXXXXX
Ultimo mensaje: "texto del último mensaje"

📋 Resumen de la conversación:
Resumen generado por IA de la conversación (máximo 3 líneas)

Responde desde el dashboard:
https://[DASHBOARD_URL]
```

Para verificar la configuración sin necesidad de WhatsApp real:
```bash
npx tsx scripts/test-escalation-roundrobin.ts   # simula 6 escalaciones
npx tsx scripts/check-escalation-agents.ts      # muestra agentes actuales en Appwrite
```

---

### 5.3 Guardar system prompt del cliente en Appwrite

Crea el archivo `scripts/save_system_prompt.py` con el siguiente contenido (adaptar los valores del cliente):

```python
import urllib.request, json

ENDPOINT = "https://varios-appwrite-techpadah.fjueze.easypanel.host/v1"
PROJECT_ID = "6a040428000ab137f00f"
API_KEY = "standard_68fa89f91b780bcf0e39e89122036d38c04663d2f6300b1c31124a968f4d282fbe719f1335b01a1c7c411ae8cb3251392b6956f456d08ebdb9766e371fcd460dc62912a8330248be000d8787295bbc113077b48a8c49b67ec9d55276272d49e7c7619be294d19e2fa94f545ada2000e89de91b7c50172b94d2286e09bd1747f5"
DATABASE_ID = "<ID de la BD>"

# Adaptar según el cliente:
SYSTEM_PROMPT = """Eres [Nombre del bot] de [Nombre empresa]. [Descripción y reglas del bot]."""

ESCALATION_PHRASES = ["frase que indica escalacion", "otra frase de escalacion"]
OFFTOPIC_PHRASES = ["frase que el bot usa para rechazar temas fuera de scope"]
HOST_PHONE = "507XXXXXXXX"
LLM_MODEL = "ibm-granite/granite-4.1-8b"

headers = {
    "Content-Type": "application/json",
    "X-Appwrite-Project": PROJECT_ID,
    "X-Appwrite-Key": API_KEY,
}

# CRITICO Appwrite 1.8: PATCH requiere {"data": {...}} — campos directos son ignorados silenciosamente
payload = json.dumps({"data": {
    "system_prompt": SYSTEM_PROMPT,
    "escalation_phrases": json.dumps(ESCALATION_PHRASES),
    "offtopic_phrases": json.dumps(OFFTOPIC_PHRASES),
    "offtopic_limit": 2,
    "host_phone": HOST_PHONE,
    "llm_model": LLM_MODEL,
    "bot_enabled": True,
}}).encode()

url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/bot_settings/documents/singleton"
req = urllib.request.Request(url, data=payload, headers=headers, method="PATCH")
with urllib.request.urlopen(req) as res:
    print("OK:", json.loads(res.read()).get("$id"))
```

Ejecutar:
```bash
python scripts/save_system_prompt.py
```

### 5.4 Conectar Telegram (si aplica)

Si el plan incluye Telegram:
1. El bot ya debería estar iniciando al arrancar el contenedor (si `TELEGRAM_BOT_TOKEN` y `ENABLED_CHANNELS` lo incluyen)
2. Envía un mensaje al bot de Telegram del cliente para verificar que responde
3. Las conversaciones aparecerán en el dashboard con el ícono de Telegram

### 5.5 Probar WebChat (si aplica)

Si el plan incluye WebChat:
- El widget embeddable está en: `https://$DOMAIN/chat-widget.js`
- Una demo funcional está en: `https://$DOMAIN/techpadah.html` (página de referencia)
- Para crear una demo nueva: copiar `public/techpadah.html`, cambiar la URL del script por la del nuevo dominio

---

## RESUMEN DE VERIFICACIÓN FINAL

- [ ] Appwrite: colecciones creadas (incluye `migrate-escalation-agents.ts` ejecutado), singleton `bot_settings` con system prompt del cliente
- [ ] EasyPanel: servicio en "Running", dominio con HTTPS activo
- [ ] Variables de entorno incluyen `DASHBOARD_URL` con la URL real del servicio
- [ ] Volumen `whatsapp-auth` montado en `/app/auth`
- [ ] Login funciona: `https://$DOMAIN/login` → 200
- [ ] WhatsApp conectado: dashboard muestra número del cliente
- [ ] Telegram activo (si aplica): bot responde en Telegram
- [ ] WebChat activo (si aplica): `/api/chat` acepta POST (no devuelve 403)
- [ ] Bot responde a mensajes de prueba con el system prompt correcto
- [ ] Escalación probada: mensaje con frase de escalación → modo HUMAN + notificación al agente/host con resumen y enlace al dashboard
- [ ] Agentes de escalación configurados (si aplica): `scripts/check-escalation-agents.ts` muestra agentes correctos

---

## Referencias de skills usadas en este prompt

- Base de datos y colecciones: `E:\Documents\aplicaciones\skills\APPWRITE\SKILL.md`
- Bot omnicanal (arquitectura completa): `E:\Documents\aplicaciones\skills\whatsapp-bot-builder-v3\SKILL.md`
- Variables de entorno y planes: `E:\Documents\aplicaciones\skills\easypanel-omnichannel-deploy\references\env-vars.md`
- API EasyPanel (todos los endpoints): `E:\Documents\aplicaciones\skills\easypanel-omnichannel-deploy\references\easypanel-api.md`
- Deploy desde GitHub: `E:\Documents\aplicaciones\skills\easypanel-deploy-from-github\SKILL.md`
- Reconexión manual WhatsApp: `E:\Documents\aplicaciones\skills\easypanel-omnichannel-deploy\references\reconnect-manual.md`

# 🗺️ Plan de Expansión Omnicanal: Agente IA Multi-plataforma

Este plan describe la evolución del sistema actual (WhatsApp-only) hacia una arquitectura capaz de gestionar Telegram, Instagram, Facebook y Chat Web desde un único Dashboard y una única IA.

---

## 🏗️ Fase 1: Evolución de la Base de Datos (Appwrite)
El objetivo es permitir que el sistema sepa de qué red social viene cada mensaje.

1.  **Modificación de Colección `conversations`:**
    *   Agregar atributo `platform`: String (Enumeración: `whatsapp`, `telegram`, `instagram`, `facebook`, `webchat`).
    *   Cambiar el índice de `phone`: El índice único actual solo funciona para WhatsApp. Se debe crear un índice compuesto `(platform, externalId)` para permitir que un mismo número o ID exista en diferentes redes.
2.  **Modificación de Colección `messages`:**
    *   (Opcional) Agregar `metadata`: Para guardar IDs de mensajes específicos de cada plataforma (necesario para funciones como "responder a un mensaje específico" o "reacciones").

---

## 🧠 Fase 2: Abstracción del "Cerebro" (Procesador Central)
Actualmente, la lógica de la IA está mezclada con la de WhatsApp. Debemos separar el "qué dice el bot" de "por dónde lo envía".

1.  **Crear `src/lib/core/message-processor.ts`:**
    *   Una función única que reciba: `texto`, `plataforma`, `ID del usuario` y `nombre`.
    *   Esta función se encarga de: Buscar/Crear conversación -> Guardar en DB -> Llamar a OpenRouter -> Retornar la respuesta.
2.  **Estrategia de Prompts Híbridos (Personalidad por Canal):**
    *   Implementar un sistema de bloques para no repetir información.
    *   **Prompt de Conocimiento (Global):** Precios, políticas, productos y FAQ. Es el mismo para todos.
    *   **Prompt de Estilo (Específico):** Instrucciones de tono y formato según la red:
        *   *WhatsApp:* Breve, servicial, uso moderado de emojis.
        *   *Instagram:* Enérgico, muy visual, hashtags y lenguaje de marca.
        *   *Telegram:* Informal, soporte de stickers y bots.
        *   *WebChat:* Orientado a conversión rápida y soporte técnico.
3.  **Estandarización de Multimedia:**
    *   Asegurar que las imágenes y audios de todas las plataformas se guarden en el mismo Bucket de Appwrite Storage.

---

## 🔌 Fase 3: Implementación de Adaptadores (Canales)
Cada plataforma necesita su propio "oído" para escuchar mensajes.

*   **Canal Telegram:** Uso de la librería `telegraf`. Es el más rápido de implementar.
*   **Canal Instagram/Facebook:** Implementación de Webhooks mediante la Graph API de Meta. Requiere un endpoint SSL (ya lo tienes con EasyPanel).
*   **Canal WebChat:** Crear un endpoint `/api/chat` en Next.js y un pequeño widget flotante para instalar en sitios web.

---

## 💻 Fase 4: Rediseño del Dashboard (UI/UX)
Separación visual de las conversaciones para mantener el orden.

1.  **Sistema de Pestañas (Tabs):**
    *   Implementar una barra de navegación superior en la lista de conversaciones: `[Todos] [WhatsApp] [Telegram] [Instagram] [Web]`.
2.  **Indicadores Visuales:**
    *   Agregar un pequeño icono (badge) de la plataforma en la burbuja de cada chat.
    *   Filtrar los datos en tiempo real usando los queries de Appwrite: `Query.equal('platform', selectedTab)`.
3.  **Configuración por Canal:**
    *   Permitir habilitar/deshabilitar canales específicos desde el panel de Settings.

---

## 🚀 Fase 5: Despliegue y Gestión de Procesos
Cómo mantener todo corriendo 24/7 en tu VPS.

1.  **Multi-proceso:**
    *   Usar un gestor de procesos (como `pm2` o contenedores separados en EasyPanel) para que si el bot de Telegram falla, el de WhatsApp siga funcionando sin problemas.
2.  **Monitorización:**
    *   Crear una vista de "Estado de Conexión" en el dashboard que muestre:
        *   🟢 WhatsApp: Conectado
        *   🟢 Telegram: Activo
        *   🔴 Instagram: Error de Token

---

## 📈 Beneficios del Plan
*   **Centralización:** Un solo `systemPrompt` controla la personalidad de tu marca en todo internet.
*   **Escalabilidad:** Puedes agregar una red social nueva en cuestión de horas, no días.
*   **Valor Comercial:** Tu producto pasa de ser un "bot de WhatsApp" a ser un "CRM de Inteligencia Artificial Omnicanal".

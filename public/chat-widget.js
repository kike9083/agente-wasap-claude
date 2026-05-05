(function () {
  "use strict";

  const BASE_URL = (window.__CHAT_WIDGET_URL__ || "").replace(/\/$/, "");
  const SESSION_KEY = "chat_widget_session";

  function getSessionId() {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #cw-fab{position:fixed;bottom:24px;right:24px;z-index:9999;width:56px;height:56px;border-radius:50%;background:#10b981;color:#fff;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);font-size:24px;display:flex;align-items:center;justify-content:center;transition:transform .2s}
      #cw-fab:hover{transform:scale(1.1)}
      #cw-box{position:fixed;bottom:92px;right:24px;z-index:9999;width:340px;max-height:520px;border-radius:16px;background:#fff;box-shadow:0 8px 32px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden;transition:opacity .2s,transform .2s;font-family:system-ui,sans-serif}
      #cw-box.hidden{opacity:0;pointer-events:none;transform:translateY(12px)}
      #cw-header{background:#10b981;color:#fff;padding:14px 16px;font-weight:600;font-size:15px;display:flex;justify-content:space-between;align-items:center}
      #cw-close{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;padding:0}
      #cw-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
      .cw-msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:14px;line-height:1.4;word-break:break-word}
      .cw-msg.user{align-self:flex-end;background:#10b981;color:#fff;border-bottom-right-radius:4px}
      .cw-msg.bot{align-self:flex-start;background:#f3f4f6;color:#111;border-bottom-left-radius:4px}
      .cw-typing{align-self:flex-start;color:#9ca3af;font-size:13px;padding:4px 12px}
      #cw-form{display:flex;border-top:1px solid #e5e7eb;padding:8px}
      #cw-input{flex:1;border:none;outline:none;padding:8px;font-size:14px;resize:none}
      #cw-send{background:#10b981;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:14px;font-weight:600}
      #cw-send:disabled{opacity:.5;cursor:not-allowed}
    `;
    document.head.appendChild(style);
  }

  function buildWidget() {
    const fab = document.createElement("button");
    fab.id = "cw-fab";
    fab.innerHTML = "💬";
    fab.title = "Chat con nosotros";

    const box = document.createElement("div");
    box.id = "cw-box";
    box.classList.add("hidden");
    box.innerHTML = `
      <div id="cw-header">
        <span>Chat en vivo</span>
        <button id="cw-close" title="Cerrar">×</button>
      </div>
      <div id="cw-messages"></div>
      <form id="cw-form">
        <input id="cw-input" type="text" placeholder="Escribe tu mensaje..." autocomplete="off" />
        <button id="cw-send" type="submit">Enviar</button>
      </form>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(box);

    const messages = box.querySelector("#cw-messages");
    const input = box.querySelector("#cw-input");
    const send = box.querySelector("#cw-send");

    fab.addEventListener("click", () => {
      box.classList.toggle("hidden");
      if (!box.classList.contains("hidden") && messages.childElementCount === 0) {
        appendMsg("bot", "¡Hola! ¿En qué puedo ayudarte hoy? 😊");
      }
      if (!box.classList.contains("hidden")) input.focus();
    });

    box.querySelector("#cw-close").addEventListener("click", () => {
      box.classList.add("hidden");
    });

    box.querySelector("#cw-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      send.disabled = true;
      appendMsg("user", text);
      showTyping();

      try {
        const res = await fetch(`${BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: getSessionId(), message: text }),
        });
        const data = await res.json();
        hideTyping();
        if (data.reply) appendMsg("bot", data.reply);
        else if (!data.reply) appendMsg("bot", "Un asesor se pondrá en contacto pronto.");
      } catch {
        hideTyping();
        appendMsg("bot", "Ocurrió un error. Por favor intenta de nuevo.");
      } finally {
        send.disabled = false;
        input.focus();
      }
    });

    let typingEl = null;

    function appendMsg(role, text) {
      const el = document.createElement("div");
      el.className = `cw-msg ${role}`;
      el.textContent = text;
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
    }

    function showTyping() {
      typingEl = document.createElement("div");
      typingEl.className = "cw-typing";
      typingEl.textContent = "Escribiendo...";
      messages.appendChild(typingEl);
      messages.scrollTop = messages.scrollHeight;
    }

    function hideTyping() {
      if (typingEl) { typingEl.remove(); typingEl = null; }
    }
  }

  injectStyles();
  buildWidget();
})();

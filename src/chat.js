// Asistente virtual: llama a /api/chat (Netlify Function) y ofrece dejar datos de contacto (/lead).
const MAX_USER_MESSAGES = 12; // por sesión de navegador
const MAX_CHARS = 500; // por mensaje (el servidor aplica el mismo límite)
const KEY = 'studio32-chat-count';

const WELCOME = '¡Hola! Soy el asistente virtual de Studio32. Puedo ayudarte con horarios, planes, reservas o dudas generales. No puedo dar consejo médico: para eso te ponemos con el equipo. ¿En qué te ayudo?';

const readCount = () => {
  try { return Number(sessionStorage.getItem(KEY)) || 0; } catch { return 0; }
};
const writeCount = (n) => {
  try { sessionStorage.setItem(KEY, String(n)); } catch { /* sin almacenamiento: el límite del servidor sigue activo */ }
};

window.aiAssistant = function aiAssistant() {
  return {
    open: false,
    input: '',
    messages: [], // lo que se ve: { from: 'bot' | 'user', text, error? }
    history: [], // lo que se envía: { role, content }
    sending: false,
    count: readCount(),
    showLead: false,
    leadDone: false,
    maxChars: MAX_CHARS,
    get limitReached() { return this.count >= MAX_USER_MESSAGES; },

    toggle() {
      this.open = !this.open;
      if (this.open) {
        if (!this.messages.length) this.messages.push({ from: 'bot', text: WELCOME });
        this.$nextTick(() => { this.scrollToBottom(); this.$refs.input?.focus(); });
      }
    },
    close() {
      this.open = false;
      this.$nextTick(() => this.$refs.bubble?.focus());
    },

    async send() {
      const text = this.input.trim();
      if (!text || this.sending || this.limitReached) return;
      if (text.length > MAX_CHARS) {
        this.messages.push({ from: 'bot', text: `Tu mensaje es demasiado largo (máximo ${MAX_CHARS} caracteres).`, error: true });
        return;
      }
      this.messages.push({ from: 'user', text });
      this.history.push({ role: 'user', content: text });
      this.input = '';
      this.count += 1;
      writeCount(this.count);
      this.sending = true;
      this.$nextTick(() => this.scrollToBottom());

      try {
        // Solo los últimos turnos; el historial enviado debe empezar por un mensaje del usuario.
        let slice = this.history.slice(-9);
        if (slice[0].role !== 'user') slice = slice.slice(1);
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: slice }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'error');
        this.history.push({ role: 'assistant', content: data.reply });
        this.messages.push({ from: 'bot', text: data.reply });
        if (data.lead && !this.leadDone) this.showLead = true;
      } catch (err) {
        // El mensaje fallido sale del historial para no romper la alternancia user/assistant.
        this.history.pop();
        this.count = Math.max(this.count - 1, 0);
        writeCount(this.count);
        const friendly = err.message && err.message !== 'error' && err.message !== 'Failed to fetch'
          ? err.message
          : 'Ahora mismo no puedo responder. Puedes reservar online, escribirnos por WhatsApp o llamar al 910 05 32 32.';
        this.messages.push({ from: 'bot', text: friendly, error: true });
      } finally {
        this.sending = false;
        this.$nextTick(() => { this.scrollToBottom(); this.$refs.input?.focus(); });
      }
    },

    // Últimas 3 preguntas del usuario (≤200 caracteres) para el aviso al equipo cuando deja sus datos en el chat
    userSummary() {
      return this.history.filter((m) => m.role === 'user').slice(-3).map((m) => m.content.slice(0, 200));
    },
    leadSent() {
      this.leadDone = true;
      this.$nextTick(() => this.scrollToBottom());
    },
    scrollToBottom() {
      const el = this.$refs.messages;
      if (el) el.scrollTop = el.scrollHeight;
    },
  };
};

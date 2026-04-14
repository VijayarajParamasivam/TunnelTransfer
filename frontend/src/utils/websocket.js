/**
 * WebSocket Manager
 *
 * Handles the connection to the FastAPI signaling server
 * and routes incoming messages by type.
 */

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const WS_BASE_URL =
  import.meta.env.VITE_WS_URL ||
  (isLocal
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`
    : "wss://tunnel-transfer-backend.vercel.app/ws");

export function createWebSocket(clientId) {
  const url = `${WS_BASE_URL}/${clientId}`;
  const listeners = {};
  let ws = null;
  let retries = 0;
  const MAX_RETRIES = 3;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("[WS] Connected as", clientId);
      retries = 0;
      emit("open", null);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("[WS] ←", msg.type, msg);
        emit(msg.type, msg);
      } catch (err) {
        console.error("[WS] Parse error:", err);
      }
    };

    ws.onclose = (event) => {
      console.log("[WS] Closed", event.code, event.reason);
      emit("close", event);
      if (retries < MAX_RETRIES && event.code !== 1000) {
        retries++;
        const delay = Math.min(1000 * 2 ** retries, 8000);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${retries})…`);
        setTimeout(connect, delay);
      }
    };

    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
      emit("error", err);
    };
  }

  function emit(type, data) {
    (listeners[type] || []).forEach((cb) => cb(data));
  }

  function on(type, callback) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(callback);
  }

  function off(type, callback) {
    if (!listeners[type]) return;
    listeners[type] = listeners[type].filter((cb) => cb !== callback);
  }

  function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify(data);
      console.log("[WS] →", data.type, data);
      ws.send(payload);
    } else {
      console.warn("[WS] Not connected, cannot send:", data);
    }
  }

  function close() {
    retries = MAX_RETRIES; // prevent reconnect
    if (ws) ws.close(1000, "User closed");
  }

  connect();

  return { on, off, send, close };
}

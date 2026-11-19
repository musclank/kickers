const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeRoomCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => ROOM_CODE_CHARS[byte % ROOM_CODE_CHARS.length]).join("");
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" } });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" } });
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const room = makeRoomCode();
      const id = env.ROOMS.idFromName(room);
      const stub = env.ROOMS.get(id);
      const response = await stub.fetch("https://room.internal/init", { method: "POST" });
      if (!response.ok) return json({ error: "Could not create room." }, 500);
      return json({ room }, 201);
    }
    if (url.pathname === "/social/ws") {
      const id = env.SOCIAL_ROOMS.idFromName("kickers-public-social-hub");
      return env.SOCIAL_ROOMS.get(id).fetch(request);
    }
    if (url.pathname === "/ws") {
      const room = (url.searchParams.get("room") || "").toUpperCase();
      const playerId = url.searchParams.get("id") || "";
      const name = url.searchParams.get("name") || "KICKERS Player";
      if (!/^[A-Z0-9]{6}$/.test(room) || !/^[a-zA-Z0-9-]{8,64}$/.test(playerId)) return json({ error: "Invalid room or player." }, 400);
      const id = env.ROOMS.idFromName(room);
      return env.ROOMS.get(id).fetch(request);
    }
    return json({ service: "KICKERS Multiplayer", status: "ready", maxPlayersPerRoom: 4 });
  }
};
export class ArenaRoom {
  constructor(state) {
    this.state = state;
    this.sessions = new Map();
    this.match = { started: false, finished: false };
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/init") return new Response("OK");
    if (url.pathname !== "/ws" || request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const id = url.searchParams.get("id");
    const name = url.searchParams.get("name") || "KICKERS Player";
    const current = this.state.getWebSockets().length;
    if (current >= 4) return new Response("Room is full", { status: 409 });
    if (this.match.finished) return new Response("Match finished. Create a new room.", { status: 409 });
    server.serializeAttachment({ id, name, x: 0, z: 2, rotation: 0, avatar: null, hp: 100, knockedOut: false, lastKickAt: 0 });
    this.state.acceptWebSocket(server);
    this.sessions.set(id, server);
    server.send(JSON.stringify({ type: "welcome", id }));
    this.broadcastRoster();
    this.tryStartMatch();
    return new Response(null, { status: 101, webSocket: client });
  }
  tryStartMatch() {
    const players = this.state.getWebSockets().map(ws => ws.deserializeAttachment() || {});
    if (!this.match.started && !this.match.finished && players.length >= 2) {
      this.match.started = true;
      this.broadcast({ type: "match-start", duration: 300, players: players.map(p => ({ id: p.id, hp: 100 })) });
    }
  }
  webSocketMessage(ws, message) {
    let data;
    try { data = JSON.parse(message); } catch { return; }
    const meta = ws.deserializeAttachment() || {};
    if (data.type === "hello") {
      if (data.avatar && typeof data.avatar === "object") meta.avatar = data.avatar;
      if (typeof data.name === "string") meta.name = data.name.replace(/[<>]/g, "").slice(0, 24) || "KICKERS Player";
      if (typeof data.walletAddress === "string" && /^0x[a-fA-F0-9]{40}$/.test(data.walletAddress)) meta.walletAddress = data.walletAddress;
      ws.serializeAttachment(meta);
      this.broadcastRoster();
      return;
    }
    if (data.type === "state") {
      meta.x = Math.max(-8, Math.min(8, Number(data.x) || 0));
      meta.z = Math.max(-8, Math.min(8, Number(data.z) || 0));
      meta.rotation = Number(data.rotation) || 0;
      ws.serializeAttachment(meta);
      this.broadcast({ type: "state", id: meta.id, x: meta.x, z: meta.z, rotation: meta.rotation }, ws);
    }
    if (data.type === "kick") {
      if (!this.match.started || this.match.finished || meta.knockedOut) return;
      const now = Date.now();
      if (now - Number(meta.lastKickAt || 0) < 650) return;
      meta.lastKickAt = now;
      ws.serializeAttachment(meta);
      this.broadcast({ type: "kick", id: meta.id });
      for (const target of this.state.getWebSockets()) {
        if (target === ws) continue;
        const victim = target.deserializeAttachment() || {};
        if (victim.knockedOut) continue;
        const dx = Number(victim.x || 0) - Number(meta.x || 0);
        const dz = Number(victim.z || 0) - Number(meta.z || 0);
        const distance = Math.hypot(dx, dz);
        if (distance > 2.15 || distance < 0.001) continue;
        victim.hp = Math.max(0, Number(victim.hp ?? 100) - 35);
        if (victim.hp <= 0) victim.knockedOut = true;
        target.serializeAttachment(victim);
        this.broadcast({ type: "combat-hit", attackerId: meta.id, targetId: victim.id, hp: victim.hp, knockX: dx / distance, knockZ: dz / distance, knockedOut: victim.knockedOut });
        if (victim.knockedOut) this.broadcast({ type: "knockout", playerId: victim.id });
      }
      const alive = this.state.getWebSockets().map(other => other.deserializeAttachment() || {}).filter(p => !p.knockedOut);
      if (alive.length === 1 && this.state.getWebSockets().length >= 2) {
        this.match.finished = true;
        this.broadcast({ type: "match-result", winnerId: alive[0].id, players: this.state.getWebSockets().map(other => { const p = other.deserializeAttachment() || {}; return { id: p.id, hp: p.hp, knockedOut: Boolean(p.knockedOut) }; }) });
      }
    }
    if (data.type === "taunt") this.broadcast({ type: "taunt", id: meta.id }, ws);
    if (data.type === "mock") this.broadcast({ type: "mock", id: meta.id }, ws);
  }
  webSocketClose(ws) {
    const meta = ws.deserializeAttachment() || {};
    this.sessions.delete(meta.id);
    this.broadcastRoster();
    if (this.state.getWebSockets().length === 0) this.match = { started: false, finished: false };
  }
  webSocketError(ws) { this.webSocketClose(ws); }
  broadcastRoster() {
    const players = this.state.getWebSockets().map(ws => ws.deserializeAttachment() || {});
    this.broadcast({ type: "roster", players });
  }
  broadcast(data, except = null) {
    const message = JSON.stringify(data);
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(message); } catch { /* Closed socket will be removed by the runtime. */ }
    }
  }
}


const SOCIAL_ROOM_CAPACITY = 20;
function cleanSocialText(value, max = 220) {
  return String(value || "").replace(/[<>]/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
export class SocialRoom {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/ws" && url.pathname !== "/social/ws") return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const sockets = this.state.getWebSockets();
    const id = url.searchParams.get("id") || "";
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) return new Response("Invalid player.", { status: 400 });
    if (sockets.length >= SOCIAL_ROOM_CAPACITY) return new Response("Social Hub is full.", { status: 409 });
    if (sockets.some(ws => (ws.deserializeAttachment() || {}).id === id)) return new Response("Already connected.", { status: 409 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({ id, name: "KICKERS Player", lastChatAt: 0, x: 0, z: 2, rotation: 0, seated: false, avatar: null });
    this.state.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "system", message: "Welcome to the KICKERS public lobby." }));
    this.broadcastRoster();
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws, message) {
    let data;
    try { data = JSON.parse(message); } catch { return; }
    const meta = ws.deserializeAttachment() || {};
    if (data.type === "hello") {
      meta.name = cleanSocialText(data.name, 24) || "KICKERS Player";
      if (data.avatar && typeof data.avatar === "object") {
        const a = data.avatar;
        meta.avatar = {
          characterType: a.characterType === "robot" ? "robot" : "human",
          skin: typeof a.skin === "string" && /^#[0-9a-f]{6}$/i.test(a.skin) ? a.skin : "#4de2d0",
          outfit: typeof a.outfit === "string" && /^#[0-9a-f]{6}$/i.test(a.outfit) ? a.outfit : "#ffb84d",
          shoes: typeof a.shoes === "string" && /^#[0-9a-f]{6}$/i.test(a.shoes) ? a.shoes : "#24243a",
          hairColor: typeof a.hairColor === "string" && /^#[0-9a-f]{6}$/i.test(a.hairColor) ? a.hairColor : "#26314d",
          hairStyle: ["none","smooth","spiky","cap"].includes(a.hairStyle) ? a.hairStyle : "smooth",
          accessory: ["none","glasses","crown","horns"].includes(a.accessory) ? a.accessory : "none",
          bodyWidth: Number.isFinite(a.bodyWidth) ? Math.max(.7,Math.min(1.5,a.bodyWidth)) : 1,
          bodyHeight: Number.isFinite(a.bodyHeight) ? Math.max(.7,Math.min(1.5,a.bodyHeight)) : 1,
          headSize: Number.isFinite(a.headSize) ? Math.max(.7,Math.min(1.5,a.headSize)) : 1,
          legLength: Number.isFinite(a.legLength) ? Math.max(.7,Math.min(1.5,a.legLength)) : 1
        };
      }
      if (Number.isFinite(data.x)) meta.x = Math.max(-7.55, Math.min(7.55, data.x));
      if (Number.isFinite(data.z)) meta.z = Math.max(-7.55, Math.min(7.55, data.z));
      if (Number.isFinite(data.rotation)) meta.rotation = data.rotation;
      ws.serializeAttachment(meta);
      this.broadcastRoster();
      return;
    }
    if (data.type === "state") {
      meta.x = Math.max(-7.55, Math.min(7.55, Number(data.x) || 0));
      meta.z = Math.max(-7.55, Math.min(7.55, Number(data.z) || 0));
      meta.rotation = Number(data.rotation) || 0;
      meta.seated = data.seated === true;
      ws.serializeAttachment(meta);
      this.broadcast({ type: "state", id: meta.id, x: meta.x, z: meta.z, rotation: meta.rotation, seated: meta.seated }, ws);
      return;
    }
    if (data.type === "chat") {
      const now = Date.now();
      if (now - Number(meta.lastChatAt || 0) < 900) return;
      const text = cleanSocialText(data.message, 220);
      if (!text) return;
      meta.lastChatAt = now;
      ws.serializeAttachment(meta);
      this.broadcast({ type: "chat", name: meta.name || "KICKERS Player", message: text });
    }
  }
  webSocketClose() { this.broadcastRoster(); }
  webSocketError() { this.broadcastRoster(); }
  broadcastRoster() {
    const players = this.state.getWebSockets().map(ws => {
      const meta = ws.deserializeAttachment() || {};
      return { id: meta.id, name: meta.name || "KICKERS Player", avatar: meta.avatar || null, x: meta.x || 0, z: meta.z || 0, rotation: meta.rotation || 0, seated: meta.seated === true };
    });
    this.broadcast({ type: "roster", players });
  }
  broadcast(data) {
    const payload = JSON.stringify(data);
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(payload); } catch { /* Cloudflare removes closed sockets. */ }
    }
  }
}

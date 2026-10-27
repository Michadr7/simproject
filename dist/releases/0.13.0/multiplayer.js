const validPlayer = p => typeof p?.id === 'string' && p.position &&
  ['x', 'y', 'z'].every(k => Number.isFinite(p.position[k])) &&
  ['street', 'market', 'cafe', 'home'].includes(p.room);

export class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.id = null; // Connection identity, separate from the saved profile ID.
    this.listeners = new Map();
  }
  on(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
    return () => this.listeners.get(type).delete(callback);
  }
  emit(type, value) { for (const cb of this.listeners.get(type) || []) cb(value); }
  onPlayerJoined(cb) { return this.on('playerJoined', cb); }
  onPlayerMoved(cb) { return this.on('playerMoved', cb); }
  onPlayerLeft(cb) { return this.on('playerLeft', cb); }
  onConnected(cb) { return this.on('connected', cb); }
  onDisconnected(cb) { return this.on('disconnected', cb); }
  connect(url) {
    this.disconnect();
    let socket;
    try { socket = new WebSocket(url); } catch {
      this.emit('disconnected'); return false;
    }
    this.socket = socket;
    socket.addEventListener('message', event => {
      if (this.socket !== socket) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message?.type === 'welcome' && typeof message.id === 'string') {
        this.id = message.id;
        this.emit('connected', message.id);
      } else if (['playerJoined', 'playerMoved'].includes(message?.type) && validPlayer(message) && message.id !== this.id) {
        this.emit(message.type, message);
      } else if (message?.type === 'playerLeft' && typeof message.id === 'string') {
        this.emit('playerLeft', message.id);
      }
    });
    socket.addEventListener('error', () => {}); // Offline play continues normally.
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null; this.id = null;
      this.emit('disconnected');
    });
    return true;
  }
  sendPosition(position, room = 'street') {
    if (this.socket?.readyState !== 1 || !this.id || this.socket.bufferedAmount > 65536) return false;
    if (!position || !['x', 'y', 'z'].every(k => Number.isFinite(position[k]))) return false;
    this.socket.send(JSON.stringify({type: 'position', position: {x: position.x, y: position.y, z: position.z}, room}));
    return true;
  }
  disconnect() {
    const socket = this.socket;
    this.socket = null; this.id = null;
    if (socket) { socket.close(); this.emit('disconnected'); }
  }
}

// The multiplayer client: connects to the relay, sends position and (as host) the game clock, and reports other players, the host and the host's clock (MP-CLOCK, session-clock.js).
import {hello,validRoom,REFUSED,validClockMessage} from './relay-protocol.js';
import {VERSION} from './version.js';

const validPlayer = p => typeof p?.id === 'string' && p.position &&
  ['x', 'y', 'z'].every(k => Number.isFinite(p.position[k])) && validRoom(p.room);

export class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.id = null; // Connection identity, separate from the saved profile ID.
    this.hostId = null; // the lobby's host (its oldest player, set by the relay); the host's game clock is the session clock (session-clock.js)
    this.lobby = null; // the hosted lobby's code; null on a local relay
    this.refused = null; // why the relay last turned us away (REFUSED in relay-protocol.js), until the next connect
    this.rejoinUrl = null; // where to reconnect after a drop: a created lobby (/relay/new) becomes its code's address once welcomed
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
  // In a room with the server: sleeping never moves the clock then (sleep.js).
  get online() { return this.socket?.readyState === 1 && !!this.id; }
  // True for the lobby's host (and while not online, so a lone game is its own host).
  get isHost() { return !this.id || !this.hostId || this.hostId === this.id; }
  onHost(cb) { return this.on('host', cb); }
  onClock(cb) { return this.on('clock', cb); }
  onConnected(cb) { return this.on('connected', cb); }
  onDisconnected(cb) { return this.on('disconnected', cb); }
  // The relay said no (old game, full lobby, unknown code). Fired before 'disconnected'.
  onRefused(cb) { return this.on('refused', cb); }
  // The connection ended without disconnect() being called (network, a relay restart, a refusal). Fired after 'disconnected'.
  onDropped(cb) { return this.on('dropped', cb); }
  connect(url) {
    this.disconnect();
    this.refused = null; this.rejoinUrl = url;
    let socket;
    try { socket = new WebSocket(url); } catch {
      this.emit('disconnected'); return false;
    }
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (this.socket === socket) socket.send(JSON.stringify(hello(VERSION)));
    });
    socket.addEventListener('message', event => {
      if (this.socket !== socket) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message?.type === 'welcome' && typeof message.id === 'string') {
        this.id = message.id;
        this.lobby = typeof message.lobby === 'string' ? message.lobby : null;
        this.hostId = typeof message.host === 'string' ? message.host : null;
        if (this.lobby) this.rejoinUrl = url.replace(/\/relay\/[^/]*$/, '/relay/' + this.lobby);
        this.emit('connected', message.id);
      } else if (message?.type === 'refused') {
        this.refused = Object.values(REFUSED).includes(message.reason) ? message.reason : REFUSED.bad;
        this.emit('refused', this.refused);
      } else if (['playerJoined', 'playerMoved'].includes(message?.type) && validPlayer(message) && message.id !== this.id) {
        this.emit(message.type, message);
      } else if (message?.type === 'host' && typeof message.id === 'string' && this.id) {
        this.hostId = message.id; this.emit('host', message.id);
      } else if (message?.type === 'clock' && validClockMessage(message) && this.id && this.hostId !== this.id) {
        this.emit('clock', {day: message.day, minutes: message.minutes});
      } else if (this.id && ['bakeryBoard','bakeryResult'].includes(message?.type)) {
        this.emit(message.type, message);
      } else if (message?.type === 'playerLeft' && typeof message.id === 'string') {
        this.emit('playerLeft', message.id);
      }
    });
    socket.addEventListener('error', () => {}); // Offline play continues normally.
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      const wasIn = !!this.id;
      this.socket = null; this.id = null; this.lobby = null; this.hostId = null;
      this.emit('disconnected');
      this.emit('dropped', {wasIn, refused: this.refused});
    });
    return true;
  }
  sendPosition(position, room = 'street', pet = null) { // PET3: pet = petSnapshot (pet-view.js) of your cat while it is shown in your home, else null
    if (this.socket?.readyState !== 1 || !this.id || this.socket.bufferedAmount > 65536) return false;
    if (!position || !['x', 'y', 'z'].every(k => Number.isFinite(position[k]))) return false;
    this.socket.send(JSON.stringify({type: 'position', position: {x: position.x, y: position.y, z: position.z}, room, ...(pet ? {pet} : {})}));
    return true;
  }
  // The host's game clock (the relay ignores it from anyone else).
  sendClock(message) {
    if (this.socket?.readyState !== 1 || !this.id || !this.isHost || !validClockMessage(message)) return false;
    this.socket.send(JSON.stringify({type: 'clock', day: message.day, minutes: message.minutes}));
    return true;
  }
  sendBakery(message) {
    if (!this.online || this.socket.bufferedAmount > 65536) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }
  disconnect() {
    const socket = this.socket;
    this.socket = null; this.id = null; this.lobby = null; this.hostId = null;
    if (socket) { socket.close(); this.emit('disconnected'); }
  }
}

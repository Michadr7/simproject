// Local development relay. Run: npm install && npm run server
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {WebSocketServer, WebSocket} from 'ws';

const validPosition = p => p && ['x', 'y', 'z'].every(k =>
  Number.isFinite(p[k]) && Math.abs(p[k]) <= 10000);
const validRoom = room => ['street', 'market', 'cafe', 'home'].includes(room);

export function startServer({port = 8080, host = '127.0.0.1'} = {}) {
  const server = new WebSocketServer({port, host, maxPayload: 4096});
  const players = new Map();
  function send(socket, message) {
    if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 65536)
      socket.send(JSON.stringify(message));
  }
  function broadcast(message, except) {
    for (const socket of players.keys()) if (socket !== except) send(socket, message);
  }
  server.on('connection', socket => {
    const player = {id: randomUUID(), position: {x: -5, y: .2, z: 15}, room: 'street'};
    send(socket, {type: 'welcome', id: player.id});
    // A new client must also see everyone already connected.
    for (const other of players.values()) send(socket, {type: 'playerJoined', ...other});
    players.set(socket, player);
    broadcast({type: 'playerJoined', ...player}, socket);
    socket.on('message', (data, binary) => {
      if (binary) return;
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      if (message?.type !== 'position' || !validPosition(message.position)) return;
      const room = message.room ?? 'street';
      if (!validRoom(room)) return;
      // Trust the socket's ID, never a client-supplied identity.
      player.position = {x: message.position.x, y: message.position.y, z: message.position.z};
      player.room = room;
      broadcast({type: 'playerMoved', ...player}, socket);
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      players.delete(socket);
      broadcast({type: 'playerLeft', id: player.id}, socket);
    });
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Loopback only unless you ask: the relay has no login, so --lan (npm run server:lan) lets anyone who can reach this computer join.
  const lan = process.argv.includes('--lan');
  const server = startServer({host: lan ? '0.0.0.0' : '127.0.0.1'});
  server.on('listening', () => console.log('City Life WebSocket server: ws://localhost:8080' +
    (lan ? '\nOPEN TO YOUR NETWORK (no login): players join with this computer\'s address, e.g. 192.168.1.20 (find it with ipconfig).' : '')));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  const stop = () => { for (const client of server.clients) client.terminate(); server.close(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

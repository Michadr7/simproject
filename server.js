// Local development relay. Run: npm install && npm run server
// One lobby for everyone who connects (no codes); the rules are the hosted relay's (dist/relay-protocol.js), so the two cannot drift apart.
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {WebSocketServer, WebSocket} from 'ws';
import {createLobby, HELLO_TIMEOUT_MS, MAX_MESSAGE_BYTES, CLOSE_REFUSED, REFUSED, PROTOCOL} from './dist/relay-protocol.js';

export function startServer({port = 8080, host = '127.0.0.1', maxPlayers} = {}) {
  const server = new WebSocketServer({port, host, maxPayload: MAX_MESSAGE_BYTES});
  const send = (socket, message) => {
    if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 65536) socket.send(JSON.stringify(message));
  };
  const lobby = createLobby({send, close: (socket, code, reason) => socket.close(code, reason), newId: randomUUID, maxPlayers});
  server.on('connection', socket => {
    // A socket that never says hello is dropped.
    const helloTimer = setTimeout(() => {
      if (!lobby.has(socket)) { send(socket, {type: 'refused', reason: REFUSED.bad, protocol: PROTOCOL}); socket.close(CLOSE_REFUSED, REFUSED.bad); }
    }, HELLO_TIMEOUT_MS);
    socket.on('message', (data, binary) => {
      if (binary) return;
      lobby.receive(socket, data.toString());
    });
    socket.on('error', () => {});
    socket.on('close', () => { clearTimeout(helloTimer); lobby.leave(socket); });
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Loopback only unless you ask: the relay has no login, so --lan (npm run server:lan) lets anyone who can reach this computer join.
  const lan = process.argv.includes('--lan');
  const server = startServer({host: lan ? '0.0.0.0' : '127.0.0.1'});
  server.on('listening', () => console.log('Eden Ridge WebSocket server: ws://localhost:8080' +
    (lan ? '\nOPEN TO YOUR NETWORK (no login): players join with this computer\'s address, e.g. 192.168.1.20 (find it with ipconfig).' : '')));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  const stop = () => { for (const client of server.clients) client.terminate(); server.close(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

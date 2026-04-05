import { WebSocketServer, WebSocket } from 'ws'; 

function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue; // ✅ fix here
        client.send(JSON.stringify(payload));
    }
}

export function attachWebSocketServer(server) {

    // ✅ FIX: use WebSocketServer
    const wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 1024 * 1024
    });

    wss.on('connection', (socket) => {
        console.log('Client connected');

        sendJson(socket, { type: 'welcome' });

        socket.on('error', console.error);
        socket.on('close', () => console.log('Client disconnected'));
    });

    function broadcastMatchCreated(match) {
        broadcast(wss, { type: 'match_created', data: match });
    }

    return { broadcastMatchCreated };
}
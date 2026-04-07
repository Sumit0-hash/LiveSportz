import { WebSocketServer, WebSocket } from 'ws'; 

function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;
    client.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue; // ✅ fix here
        client.send(JSON.stringify(payload));
    }
}

export function attachWebSocketServer(server) {

    const wss = new WebSocketServer({ noServer: true, path: '/ws', maxPayload: 1024 * 1024 });

    wss.on('connection', (socket) => {
        socket.isAlive = true;
        socket.on('pong',()=>{socket.isAlive=true;});
        sendJson(socket, { type: 'welcome' });
        socket.on('error',console.error)
        console.log('Client connected');

    });
    const interval=setInterval(()=>{
        wss.clients.forEach((ws)=>{
            if(ws.isAlive===false) return ws.terminate();
            ws.isAlive=false;
            ws.ping();
        })
    },30000);

    ws.on('close',()=>clearInterval(interval));

    function broadcastMatchCreated(match) {
        broadcast(wss, { type: 'match_created', data: match });
    }

    return { broadcastMatchCreated };
}
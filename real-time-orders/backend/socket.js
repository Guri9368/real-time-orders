const WebSocket = require('ws');

// we attach the ws server to the same http server express uses
// so everything runs on one port
let wss = null;

// keep track of every connected browser tab
const clients = new Set();

function init(httpServer) {
    wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

    wss.on('connection', (ws, req) => {
        clients.add(ws);
        console.log(`[ws] client connected  — total: ${clients.size}`);

        // tell the browser it connected successfully
        send(ws, { type: 'connected', message: 'you are live' });

        ws.on('close', () => {
            clients.delete(ws);
            console.log(`[ws] client left  — total: ${clients.size}`);
        });

        ws.on('error', (err) => {
            console.error('[ws] client error:', err.message);
            clients.delete(ws);
        });
    });

    // ping every client every 30s so we can detect dead connections
    setInterval(() => {
        clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            } else {
                clients.delete(ws);
            }
        });
    }, 30000);

    console.log('[ws] websocket server ready on path /ws');
}

// send to one specific client
function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

// send to every connected client
function broadcast(data) {
    if (clients.size === 0) return;

    const message = JSON.stringify(data);

    clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });

    console.log(`[ws] broadcasted to ${clients.size} client(s)`);
}

function getClientCount() {
    return clients.size;
}

module.exports = { init, broadcast, getClientCount };
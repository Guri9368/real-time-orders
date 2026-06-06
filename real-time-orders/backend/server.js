require('dotenv').config();

const express  = require('express');
const http     = require('http');
const cors     = require('cors');
const path     = require('path');

const { testPool }       = require('./db');
const socket             = require('./socket');
const { startListening } = require('./listener');
const ordersRouter       = require('./routes/orders');

const app  = express();
const PORT = process.env.SERVER_PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// serve the client folder as static files
app.use(express.static(path.join(__dirname, '../client')));

// routes
app.use('/api/orders', ordersRouter);

// quick health check so you can see if server is up
app.get('/health', (req, res) => {
    res.json({
        status:          'ok',
        connectedClients: socket.getClientCount(),
        time:            new Date().toISOString(),
    });
});

// catch all — serve the html page for any unknown route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// create one http server and share it with express and websockets
const httpServer = http.createServer(app);

async function start() {
    try {
        console.log('\nstarting up...\n');

        // 1. make sure postgres is reachable
        await testPool();

        // 2. attach websocket server to the http server
        socket.init(httpServer);

        // 3. start listening for postgres notifications
        await startListening();

        // 4. finally open the port
        httpServer.listen(PORT, () => {
            console.log('\n------------------------------------------');
            console.log(`server running at  http://localhost:${PORT}`);
            console.log(`websocket at       ws://localhost:${PORT}/ws`);
            console.log(`api at             http://localhost:${PORT}/api/orders`);
            console.log(`health check at    http://localhost:${PORT}/health`);
            console.log('------------------------------------------\n');
        });

    } catch (err) {
        console.error('failed to start server:', err.message);
        process.exit(1);
    }
}

// clean shutdown on ctrl+c
process.on('SIGINT', () => {
    console.log('\nshutting down...');
    httpServer.close(() => {
        console.log('bye');
        process.exit(0);
    });
});

start();
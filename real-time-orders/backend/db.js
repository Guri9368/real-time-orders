const { Pool, Client } = require('pg');
require('dotenv').config();

// shared config pulled from .env
const config = {
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
};

// pool is used for all normal queries (select, insert, update, delete)
const pool = new Pool({
    ...config,
    max:                  10,
    idleTimeoutMillis:    30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('[db] pool error:', err.message);
});

// listener is a single dedicated connection just for LISTEN/NOTIFY
// we keep it separate because a connection in listen mode should not
// be used for regular queries at the same time
const listener = new Client(config);

async function connectListener() {
    await listener.connect();
    console.log('[db] listener client connected');
}

async function testPool() {
    const res = await pool.query('SELECT NOW() AS time');
    console.log('[db] pool connected, server time:', res.rows[0].time);
}

module.exports = { pool, listener, connectListener, testPool };
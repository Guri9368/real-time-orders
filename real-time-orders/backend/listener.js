const { listener, connectListener } = require('./db');
const socket = require('./socket');

// this is the heart of the real time system
// we tell postgres "hey, tell me whenever something changes on the order_changes channel"
// postgres does that via the trigger we set up in trigger.sql
async function startListening() {
    try {
        await connectListener();

        // subscribe to the channel
        await listener.query('LISTEN order_changes');
        console.log('[listener] subscribed to channel: order_changes');

        // this fires every time postgres sends a notification on that channel
        listener.on('notification', (msg) => {
            try {
                console.log('[listener] got notification from postgres');

                const payload = JSON.parse(msg.payload);
                const order   = payload.data;
                const op      = payload.operation; // INSERT UPDATE DELETE

                // build a clean message to send to the browser
                const update = {
                    type:      'order_update',
                    operation: op,
                    order:     order,
                    message:   buildMessage(op, order),
                };

                // push it to every connected browser tab
                socket.broadcast(update);

            } catch (err) {
                console.error('[listener] failed to parse notification:', err.message);
            }
        });

        listener.on('error', (err) => {
            console.error('[listener] connection error:', err.message);
        });

    } catch (err) {
        console.error('[listener] failed to start:', err.message);
        throw err;
    }
}

// makes a human readable sentence about what changed
function buildMessage(operation, order) {
    switch (operation) {
        case 'INSERT':
            return `New order #${order.id} — ${order.customer_name} ordered ${order.product_name}`;
        case 'UPDATE':
            return `Order #${order.id} updated — ${order.product_name} is now "${order.status}"`;
        case 'DELETE':
            return `Order #${order.id} was deleted`;
        default:
            return `Order #${order.id} changed`;
    }
}

module.exports = { startListening };
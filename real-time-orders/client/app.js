// all the client side logic lives here
// it connects via websocket and also calls the rest api

const API = '/api/orders';
const WS  = `ws://${window.location.host}/ws`;

// local copy of all orders so we don't have to refetch every time
let orders = {};

let ws             = null;
let reconnectTimer = null;


// ---------------------------------------------------------------------------
// websocket
// ---------------------------------------------------------------------------

function connectWS() {
    setStatus('connecting');

    ws = new WebSocket(WS);

    ws.onopen = () => {
        setStatus('connected');
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };

    ws.onmessage = (evt) => {
        let msg;
        try { msg = JSON.parse(evt.data); }
        catch { return; }

        handleMessage(msg);
    };

    ws.onclose = () => {
        setStatus('disconnected');
        // try to reconnect every 3 seconds
        if (!reconnectTimer) {
            reconnectTimer = setTimeout(connectWS, 3000);
        }
    };

    ws.onerror = () => {
        setStatus('disconnected');
    };
}

function handleMessage(msg) {
    if (msg.type === 'connected') {
        addFeedItem('info', '🔌 connected to live updates');
        return;
    }

    if (msg.type === 'order_update') {
        const { operation, order, message } = msg;

        if (operation === 'INSERT') {
            orders[order.id] = order;
            prependRow(order);
            addFeedItem('insert', '🆕 ' + message);
        }

        if (operation === 'UPDATE') {
            orders[order.id] = order;
            replaceRow(order);
            addFeedItem('update', '✏️ ' + message);
        }

        if (operation === 'DELETE') {
            delete orders[order.id];
            removeRow(order.id);
            addFeedItem('delete', '🗑️ ' + message);
        }

        refreshStats();
        setLastUpdated();
    }
}


// ---------------------------------------------------------------------------
// load initial orders on page load
// ---------------------------------------------------------------------------

async function loadOrders() {
    try {
        const res  = await fetch(API);
        const data = await res.json();

        if (!data.success) return;

        orders = {};
        data.orders.forEach(o => { orders[o.id] = o; });

        renderTable();
        refreshStats();

    } catch (err) {
        console.error('could not load orders:', err);
    }
}


// ---------------------------------------------------------------------------
// table rendering
// ---------------------------------------------------------------------------

function renderTable() {
    const tbody = document.getElementById('tbody');
    const list  = sortedOrders();

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">no orders yet — create one</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(rowHTML).join('');
}

// newest first
function sortedOrders() {
    return Object.values(orders).sort(
        (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
    );
}

function rowHTML(o) {
    const time = new Date(o.updated_at).toLocaleString();

    const shipBtn = (o.status === 'pending')
        ? `<button class="act-btn ship" onclick="changeStatus(${o.id},'shipped')">Ship</button>`
        : '';

    const deliverBtn = (o.status !== 'delivered')
        ? `<button class="act-btn deliver" onclick="changeStatus(${o.id},'delivered')">Deliver</button>`
        : '';

    return `
        <tr id="row-${o.id}">
            <td class="id-col">#${o.id}</td>
            <td class="name-col">${esc(o.customer_name)}</td>
            <td class="product-col">${esc(o.product_name)}</td>
            <td><span class="pill ${o.status}">${o.status}</span></td>
            <td class="time-col">${time}</td>
            <td>
                <div class="actions">
                    ${shipBtn}
                    ${deliverBtn}
                    <button class="act-btn del" onclick="deleteOrder(${o.id})">Delete</button>
                </div>
            </td>
        </tr>
    `;
}

// add new row at the top with a green flash
function prependRow(o) {
    const tbody = document.getElementById('tbody');

    // remove empty state row if it's there
    const empty = tbody.querySelector('.table-empty');
    if (empty) empty.closest('tr').remove();

    const tmp = document.createElement('tbody');
    tmp.innerHTML = rowHTML(o);
    const row = tmp.firstElementChild;
    row.classList.add('row-insert');

    tbody.insertBefore(row, tbody.firstChild);
}

// swap out an existing row with updated data and flash blue
function replaceRow(o) {
    const existing = document.getElementById(`row-${o.id}`);

    if (!existing) {
        prependRow(o);
        return;
    }

    const tmp = document.createElement('tbody');
    tmp.innerHTML = rowHTML(o);
    const row = tmp.firstElementChild;
    row.classList.add('row-update');

    existing.replaceWith(row);
}

// fade the row out then remove it
function removeRow(id) {
    const row = document.getElementById(`row-${id}`);
    if (!row) return;

    row.style.opacity    = '0';
    row.style.transition = 'opacity 0.4s';

    setTimeout(() => {
        row.remove();
        if (Object.keys(orders).length === 0) renderTable();
    }, 400);
}


// ---------------------------------------------------------------------------
// api calls — the websocket handles all ui updates after these
// ---------------------------------------------------------------------------

async function createOrder() {
    const name    = document.getElementById('cname').value.trim();
    const product = document.getElementById('pname').value.trim();
    const status  = document.getElementById('ostatus').value;
    const btn     = document.getElementById('create-btn');

    if (!name || !product) {
        alert('please fill in customer name and product name');
        return;
    }

    btn.disabled    = true;
    btn.textContent = 'creating...';

    try {
        const res = await fetch(API, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ customer_name: name, product_name: product, status }),
        });

        const data = await res.json();

        if (data.success) {
            document.getElementById('cname').value    = '';
            document.getElementById('pname').value    = '';
            document.getElementById('ostatus').value  = 'pending';
            // the websocket notification will update the table automatically
        } else {
            alert('error: ' + data.error);
        }
    } catch (err) {
        alert('request failed: ' + err.message);
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Create Order';
    }
}

async function changeStatus(id, newStatus) {
    try {
        await fetch(`${API}/${id}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ status: newStatus }),
        });
        // websocket will handle the ui update
    } catch (err) {
        alert('failed to update: ' + err.message);
    }
}

async function deleteOrder(id) {
    if (!confirm(`delete order #${id}?`)) return;

    try {
        await fetch(`${API}/${id}`, { method: 'DELETE' });
        // websocket will handle the ui update
    } catch (err) {
        alert('failed to delete: ' + err.message);
    }
}


// ---------------------------------------------------------------------------
// stats
// ---------------------------------------------------------------------------

function refreshStats() {
    const list = Object.values(orders);

    document.getElementById('stat-total').textContent     = list.length;
    document.getElementById('stat-pending').textContent   = list.filter(o => o.status === 'pending').length;
    document.getElementById('stat-shipped').textContent   = list.filter(o => o.status === 'shipped').length;
    document.getElementById('stat-delivered').textContent = list.filter(o => o.status === 'delivered').length;
}


// ---------------------------------------------------------------------------
// activity feed
// ---------------------------------------------------------------------------

function addFeedItem(type, message) {
    const feed = document.getElementById('feed');

    // remove the placeholder text if it's still there
    const empty = feed.querySelector('.feed-empty');
    if (empty) empty.remove();

    const time = new Date().toLocaleTimeString();

    const item = document.createElement('div');
    item.className = `feed-item ${type}`;
    item.innerHTML = `
        <div class="feed-msg">${message}</div>
        <div class="feed-time">${time}</div>
    `;

    feed.insertBefore(item, feed.firstChild);

    // keep the feed from getting too long
    const all = feed.querySelectorAll('.feed-item');
    if (all.length > 50) all[all.length - 1].remove();
}

function clearFeed() {
    document.getElementById('feed').innerHTML =
        '<div class="feed-empty">feed cleared</div>';
}


// ---------------------------------------------------------------------------
// ui helpers
// ---------------------------------------------------------------------------

function setStatus(state) {
    const el     = document.getElementById('conn-status');
    const labels = {
        connected:    '🟢 Live',
        disconnected: '🔴 Disconnected',
        connecting:   '🟡 Connecting...',
    };
    el.className   = `conn-status ${state}`;
    el.textContent = labels[state] || state;
}

function setLastUpdated() {
    const el = document.getElementById('last-updated');
    if (el) el.textContent = 'last update: ' + new Date().toLocaleTimeString();
}

// prevent xss when rendering user data
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}


// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    connectWS();
});
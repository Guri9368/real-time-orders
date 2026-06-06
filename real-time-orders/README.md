Markdown

# Real-Time Orders System

Push database changes to every connected browser tab instantly —
no polling, no refresh needed.

## How it works
browser ──REST──▶ Express ──SQL──▶ Postgres
│
trigger fires
│
pg_notify('order_changes')
│
Node listener ◀───┘
│
ws.broadcast()
│
every browser tab ◀───┘

text
<img width="1878" height="857" alt="image" src="https://github.com/user-attachments/assets/d22dd4d1-546f-4c9c-9a04-12b957e5021f" />


1. A REST call (or direct SQL) changes a row in `orders`
2. A Postgres trigger calls `pg_notify` with the changed row as JSON
3. Our dedicated listener client receives the notification instantly
4. It broadcasts the update over WebSocket to every open browser tab
5. The browser updates the table and the live feed — no refresh needed

## Tech stack

- **Node.js + Express** — HTTP API and static file server
- **ws** — WebSocket server
- **node-postgres (pg)** — database driver
- **PostgreSQL** — database + LISTEN/NOTIFY + triggers

## Project layout
real-time-orders/
├── backend/
│ ├── server.js main entry point
│ ├── db.js pool + listener client
│ ├── socket.js websocket manager
│ ├── listener.js postgres LISTEN logic
│ ├── routes/
│ │ └── orders.js REST endpoints
│ ├── package.json
│ └── .env
├── client/
│ ├── index.html
│ ├── app.js
│ └── style.css
├── sql/
│ ├── schema.sql creates the orders table
│ └── trigger.sql creates the trigger + notify function
└── README.md

text


## Setup and run

### 1 — clone and install

```bash
git clone https://github.com/Guri9368/real-time-orders
cd real-time-orders/backend
npm install
2 — create the database
Bash

psql -U postgres
SQL

CREATE DATABASE orders_db;
\q
3 — run the sql files
Bash

psql -U postgres -d orders_db -f ../sql/schema.sql
psql -U postgres -d orders_db -f ../sql/trigger.sql
4 — configure environment
Edit backend/.env and set your postgres password:

env

DB_HOST     = localhost
DB_PORT     = 5432
DB_NAME     = orders_db
DB_USER     = postgres
DB_PASSWORD = your_actual_password

SERVER_PORT = 3000
5 — start the server
Bash

# inside backend/
npm run dev      # uses nodemon, restarts on file change
# or
npm start        # plain node
You should see:

text

server running at  http://localhost:3000
websocket at       ws://localhost:3000/ws
api at             http://localhost:3000/api/orders
health check at    http://localhost:3000/health
6 — open the browser
Go to http://localhost:3000

Open a second tab at the same URL — both tabs will update together.

7 — test it
Via the UI — use the "New Order" form on the right side.

Via curl:

Bash

# create
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Alice","product_name":"Laptop","status":"pending"}'

# update status
curl -X PATCH http://localhost:3000/api/orders/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"shipped"}'

# delete
curl -X DELETE http://localhost:3000/api/orders/1
Direct SQL (bypasses the API, trigger still fires):

Bash

psql -U postgres -d orders_db
SQL

INSERT INTO orders (customer_name, product_name, status)
VALUES ('Bob', 'Monitor', 'pending');

UPDATE orders SET status = 'delivered' WHERE id = 1;

DELETE FROM orders WHERE id = 1;
Watch both browser tabs update in real time.

API reference
Method	Path	Body	Description
GET	/api/orders	—	list all orders
GET	/api/orders/:id	—	get one order
POST	/api/orders	customer_name, product_name, status?	create
PATCH	/api/orders/:id	any field	update
DELETE	/api/orders/:id	—	delete
GET	/health	—	server status
Common problems
"password authentication failed"
Double check DB_PASSWORD in .env

"database orders_db does not exist"
Run CREATE DATABASE orders_db; in psql first

"listen tcp :3000 address already in use"
Change SERVER_PORT in .env or kill whatever is on port 3000

Table updates but browser does not react
Open the browser console and check for websocket errors.
Make sure you are visiting http://localhost:3000 not a file:// URL.

text


---

## Quick Setup Commands (Copy & Paste)

```bash
# 1. create project and install
mkdir real-time-orders && cd real-time-orders
mkdir -p backend/routes client sql

# 2. copy all the files into place (or create them manually)

# 3. install dependencies
cd backend && npm install && cd ..

# 4. setup database
psql -U postgres -c "CREATE DATABASE orders_db;"
psql -U postgres -d orders_db -f sql/schema.sql
psql -U postgres -d orders_db -f sql/trigger.sql

# 5. set your password in backend/.env
# DB_PASSWORD = your_password_here

# 6. run
cd backend && npm run dev

# 7. open browser
# http://localhost:3000

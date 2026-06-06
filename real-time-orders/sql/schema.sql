-- create the orders table
CREATE TABLE IF NOT EXISTS orders (
    id            SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    product_name  VARCHAR(255) NOT NULL,
    status        VARCHAR(50)  NOT NULL DEFAULT 'pending',
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (
        status IN ('pending', 'shipped', 'delivered')
    )
);
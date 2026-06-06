const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

const VALID_STATUSES = ['pending', 'shipped', 'delivered'];

// GET /api/orders
// returns all orders newest first
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM orders ORDER BY updated_at DESC'
        );
        res.json({ success: true, orders: result.rows });
    } catch (err) {
        console.error('[route] GET /orders error:', err.message);
        res.status(500).json({ success: false, error: 'server error' });
    }
});

// GET /api/orders/:id
// returns a single order
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'id must be a number' });

        const result = await pool.query(
            'SELECT * FROM orders WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `order ${id} not found` });
        }

        res.json({ success: true, order: result.rows[0] });
    } catch (err) {
        console.error('[route] GET /orders/:id error:', err.message);
        res.status(500).json({ success: false, error: 'server error' });
    }
});

// POST /api/orders
// create a new order
// body: { customer_name, product_name, status? }
router.post('/', async (req, res) => {
    try {
        const { customer_name, product_name, status = 'pending' } = req.body;

        if (!customer_name || !product_name) {
            return res.status(400).json({ error: 'customer_name and product_name are required' });
        }

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ error: 'status must be pending, shipped or delivered' });
        }

        // after this insert the trigger fires automatically
        // which notifies the listener which broadcasts to all browsers
        const result = await pool.query(
            `INSERT INTO orders (customer_name, product_name, status, updated_at)
             VALUES ($1, $2, $3, NOW())
             RETURNING *`,
            [customer_name.trim(), product_name.trim(), status]
        );

        res.status(201).json({ success: true, order: result.rows[0] });
    } catch (err) {
        console.error('[route] POST /orders error:', err.message);
        res.status(500).json({ success: false, error: 'server error' });
    }
});

// PATCH /api/orders/:id
// update status (or any field)
// body: { status?, customer_name?, product_name? }
router.patch('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'id must be a number' });

        // make sure the order exists first
        const check = await pool.query('SELECT id FROM orders WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: `order ${id} not found` });
        }

        // build update query dynamically based on what was sent
        const fields = [];
        const values = [];
        let   idx    = 1;

        if (req.body.customer_name !== undefined) {
            fields.push(`customer_name = $${idx++}`);
            values.push(req.body.customer_name.trim());
        }

        if (req.body.product_name !== undefined) {
            fields.push(`product_name = $${idx++}`);
            values.push(req.body.product_name.trim());
        }

        if (req.body.status !== undefined) {
            if (!VALID_STATUSES.includes(req.body.status)) {
                return res.status(400).json({ error: 'invalid status value' });
            }
            fields.push(`status = $${idx++}`);
            values.push(req.body.status);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'nothing to update' });
        }

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const result = await pool.query(
            `UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        res.json({ success: true, order: result.rows[0] });
    } catch (err) {
        console.error('[route] PATCH /orders/:id error:', err.message);
        res.status(500).json({ success: false, error: 'server error' });
    }
});

// DELETE /api/orders/:id
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'id must be a number' });

        const result = await pool.query(
            'DELETE FROM orders WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `order ${id} not found` });
        }

        res.json({ success: true, order: result.rows[0] });
    } catch (err) {
        console.error('[route] DELETE /orders/:id error:', err.message);
        res.status(500).json({ success: false, error: 'server error' });
    }
});

module.exports = router;